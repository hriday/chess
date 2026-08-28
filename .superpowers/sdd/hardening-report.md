# Security/UX hardening batch — report

Branch: `worktree-hardening`, forked from `main` at `2b06def`.
Baseline: `npm test` 90/90 green before starting; 110/110 green after (20 new tests, no removals).

## 1. Hash session tokens at rest

`src/lib/auth/session.ts:1-42`

- Added `hashSessionToken(token: string): string` (node `crypto.createHash("sha256")`, hex digest), documented inline with the threat model (leaked DB row/backup/replica can't be replayed as a cookie).
- `generateSessionToken()` unchanged — still returns the raw 48-hex token, which is what goes in the cookie.
- `createSession` (`session.ts:23`) now inserts `id: hashSessionToken(token)` instead of the raw token, while still returning the raw token to the caller for the cookie.
- `getSessionUser` (`session.ts:29-37`) and `deleteSession` (`session.ts:41`) hash the incoming token before the `where` clause.
- No schema/migration change needed — `sessions.id` is already `text`, so a 64-hex-char hash fits without a column change.

**Test evidence**: `src/lib/auth/session.test.ts` — added a `describe("hashSessionToken")` block: 64-hex-char output, deterministic for the same input, and differs from the raw token (`session.test.ts:17-28`). Full suite still exercises `createSession`/`getSessionUser`/`deleteSession` indirectly via other route tests (login, signup, games routes all mock `@/db`, so they don't independently verify the hash-based lookup against a real DB — that's covered by the unit test on `hashSessionToken` plus the fact the route logic is unchanged, only the token passed to `db` differs).

**Deploy note**: all existing production session rows are keyed by the raw token; after this deploys, `getSessionUser`/`deleteSession` will look up by `sha256(token)` and find nothing, so every logged-in user is silently logged out and must log in again. No migration script was written to rehash existing rows in place (the raw token isn't recoverable from a hash, so in-place migration is impossible anyway — old sessions can only be invalidated, not rehashed). Accepted per instructions.

## 2. Login timing oracle + rate limiting

**Timing oracle** — `src/app/api/auth/login/route.ts`:
- Added a module-level `DUMMY_HASH` constant (`route.ts:14`), a real argon2id hash of a random, discarded string, generated once locally with the exact same params as `hashPassword` (`memoryCost: 19456, timeCost: 2, parallelism: 1`) via:
  ```
  node -e "require('@node-rs/argon2').hash('correct horse battery staple ' + Math.random(), { memoryCost: 19456, timeCost: 2, parallelism: 1 }).then(h => console.log(h))"
  ```
  Output pasted as the literal string:
  `$argon2id$v=19$m=19456,t=2,p=1$sC0+Po3jNDgA66Iwrbzd/Q$TesMTl9stNDORHV4zIi9WN4yCBJnaBAOEqnkadJcQUw`
  The plaintext behind it was never stored or reused anywhere.
- On an email-lookup miss, the route now calls `verifyPassword(DUMMY_HASH, password)` before returning the same 401 body (`route.ts:22-25`), so a failed login always pays one argon2 verify, whether or not the email exists — closing the timing side-channel that let an attacker enumerate registered emails.

**Rate limiting** — new `src/lib/rateLimit.ts`:
- Pure, in-memory fixed-window counter: `rateLimit(bucket, key, limit, windowMs, now = Date.now()): boolean`. Map key is `${bucket}:${key}`; each entry stores `{count, windowStart, windowMs}` (windowMs stored per-entry so opportunistic pruning is correct even if different buckets use different window sizes — this was a bug I caught and fixed during TDD: pruning against the *current call's* windowMs instead of the entry's own would prune still-valid entries early and silently reset their count).
- Pruning is opportunistic: every 100 calls, sweep and drop windows that have fully expired, so the map doesn't grow unbounded across many distinct IPs.
- `_reset()` exported for tests.
- TDD: `src/lib/rateLimit.test.ts` (6 tests) written before the implementation — allows up to limit, blocks over limit, resets after window elapses, buckets are independent, keys within a bucket are independent, `now` is injectable.

**Wiring**:
- `src/lib/requestIp.ts` — shared helper: `req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"`.
- `src/app/api/auth/login/route.ts:17-19` — bucket `"login"`, 10/15min per IP, checked before any DB/argon2 work.
- `src/app/api/auth/signup/route.ts:10-11` — bucket `"signup"`, 10/15min per IP.
- `src/app/api/explain/route.ts:9-10` — bucket `"explain"`, 30/10min per IP, checked before `requirePaid()` and before the LLM call.
- All three return `429 {"error": "Too many requests — try again later"}`.

**Test evidence**:
- `src/app/api/auth/login/route.test.ts` (new file, 6 tests) — this route had no prior test file. Covers 400 on missing fields, 401 + dummy-hash-verify-called on unknown email (asserts `verifyPassword` was called once with the submitted password, proving the timing-oracle fix), 401 on wrong password, 200 + cookie on success, 429 after 10 requests from one IP, and independence across IPs.
- `src/app/api/auth/signup/route.test.ts` — added a 429-after-limit test (`route.test.ts:52-62`). Note: the existing `@/db` mock returns a shared "existing users" array regardless of email, so only the first of the 10 calls in that test actually returns 200; the rest return 409. That's fine — the test asserts none of the first 10 return 429, and the 11th does, which is what's being verified.
- `src/app/api/explain/route.test.ts` — added a 429 test (`route.test.ts:153-163`) asserting the LLM (`explainMove`) is never called once rate-limited.
- All new/modified test files call `_reset()` in `beforeEach` to isolate the shared module-level rate-limit store between tests.

## 3. systemd sandboxing

`deploy/chess.service` — added under `[Service]`:
```
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/opt/chess/app/.next
```
`ReadWritePaths` carves the Next.js runtime-cache directory back out of the otherwise-read-only filesystem (`ProtectSystem=strict` makes almost everything outside `/etc`, `/dev` etc. read-only). File edit only, per instructions — **not applied to the running server**. Before rolling this out live: verify `/opt/chess/app/.next` is writable by the `chess` user, and have a rollback plan (revert the unit file, `systemctl daemon-reload`, `systemctl restart chess`) in case some other runtime path (e.g. a temp upload dir, a `node_modules/.cache`) also needs write access that isn't yet accounted for — `ProtectSystem=strict` is unforgiving of anything missed.

## 4. Admin delete for cached AI explanations

`src/app/api/admin/annotations/route.ts:34-49` — new `DELETE` handler: `requireAdmin()`, validates `gameId` (string), `ply` (`Number.isInteger` and `>= 0`), `source` (`"admin" | "llm"` exactly), 400 on any validation failure, deletes the matching row via the existing `(gameId, ply, source)` unique index, returns `{ok: true}`.

`src/components/admin/AnnotationEditor.tsx` — when `annotations[currentPly]?.llm` is set, renders a "Delete AI explanation" button (`AnnotationEditor.tsx:39-42`) that `DELETE`s with `source: "llm"` and, on success, clears `llm` for that ply in `useGameStore` via `setState` merge (`AnnotationEditor.tsx:29-31`), matching the existing save handler's pattern of setting the field to `undefined` rather than deleting the key.

**Test evidence**: `src/app/api/admin/admin.test.ts` — extended the existing gating test to also assert 403 for non-admins on `DELETE /api/admin/annotations` (`admin.test.ts:27-33`), plus a new `describe("DELETE /api/admin/annotations")` block: 200 happy path, 400 for negative ply, 400 for invalid source (3 tests). The AnnotationEditor UI change itself has no component test (see coverage gaps below).

## 5. Delete saved games from /games

New `src/components/DeleteGameButton.tsx` — two-step inline confirm built on the shared `useTwoStepConfirm` hook (see item 6): first click shows "Confirm delete" for 4s, second click `DELETE /api/games/${id}` then `window.location.reload()`. No `confirm()` dialog.

Mounted in `src/app/games/page.tsx:19-24`, next to each row's result span (wrapped both in a flex span so they sit together on the right of the row).

The `DELETE /api/games/[id]` route already existed and already enforced ownership (`src/app/api/games/[id]/route.ts:22-34`, tested in `route.test.ts`) — no backend change needed for this item, only the UI affordance.

## 6. Famous-game delete confirmation

`src/components/admin/FamousGameForm.tsx` — same two-step pattern, applied to the existing Delete button.

**Choice**: extracted a tiny shared hook, `src/lib/useTwoStepConfirm.ts` (`confirming` state + armed/execute `onClick`, auto-revert via `setTimeout`, cleanup on unmount), rather than duplicating the ~10-line state machine twice or writing a shared `<ConfirmButton>` component. Reasoning: the two call sites want different button markup/copy context (`DeleteGameButton` is a standalone button; the famous-game row needed a new `FamousGameRow` subcomponent since hooks can't be called inside `.map()` — extracting that subcomponent was needed anyway to give the hook a stable per-row instance). A hook shares the *behavior* (timing, state, revert) without forcing both call sites into identical JSX/styling. `DeleteGameButton` was refactored to use the same hook for consistency (`DeleteGameButton.tsx`).

## Verification

- `npm test`: **110/110 passed** (19 test files; 90 baseline + 20 new: 3 session-hash, 6 rateLimit, 6 login route incl. 1 rate-limit test, 1 signup rate-limit test, 1 explain rate-limit test, 3 admin-delete-annotation tests — some counted above already include the 403-gating extension).
- `npm run lint`: 0 errors, 4 warnings — all 4 pre-existing (`_cols`/`_a`/`cols` unused destructured params in `src/app/api/games/[id]/route.test.ts` and `src/app/api/games/route.test.ts`), untouched by this batch.
- `npm run build`: succeeds, all 17 routes compile/prerender as before, no new type errors.

## Coverage gaps (acceptable, as instructed)

- **UI two-step confirms** (`DeleteGameButton`, `FamousGameForm`'s delete row) have no automated test — no existing Playwright e2e coverage for `/games` or the admin famous-games list, and the task explicitly scoped e2e to DropZone/MoveList/theme plus flagged famous-delete as not e2e-covered. Manual verification only.
- **`AnnotationEditor`'s new "Delete AI explanation" button** has no component test (there's no existing test file for this component to extend, and the task didn't ask for one — only the API route's admin-gating was extended).
- **Session hashing end-to-end**: no test exercises `createSession` → `getSessionUser` → `deleteSession` against a real (or fully faked) DB round-trip using the hash; coverage is a direct unit test of `hashSessionToken` plus the unchanged route-level tests (which mock `@/db` and don't care what string is used as the lookup key). The property under test — "the hash is deterministic, 64 hex chars, and not equal to the input" — is what actually matters for correctness of the lookup; the route wiring is a 3-line diff reviewed by hand.

## Self-review / concerns

- **Rate-limit store is per-process, in-memory, unbounded between prunes**: fine for the stated single-Node-process deployment; would need a shared store (Redis) if the app ever scales horizontally. Documented in the file header comment.
- **Rate limits are IP-keyed only**: behind Caddy with XFF, a shared IP (NAT, corporate proxy, VPN) will share a limit bucket across unrelated users. Accepted per the spec (Caddy sets XFF; `"local"` fallback for direct connections is a shared bucket for all direct traffic, which in practice is just dev/tests).
- **`DUMMY_HASH` provenance**: generated once, locally, from a throwaway random string that was never persisted or logged anywhere outside the one `node -e` invocation; the hash itself reveals nothing about the discarded plaintext (argon2id resists exactly this).
- **`ReadWritePaths=/opt/chess/app/.next` may be incomplete**: I didn't have server access to verify there's no *other* runtime-writable path (e.g., if Next's `output: 'standalone'` mode or some cache writes elsewhere, or if there's a temp-upload directory). Flagged explicitly for the controller doing the actual rollout — test in a non-prod checkout or with a fast rollback path first.
- **Signup's rate-limit test asserts on a quirk of the existing `@/db` mock** (shared "existing users" array ignores the query, so only the first of 10 signups actually succeeds) — noted in a code comment at the test so a future reader isn't confused about why 9 of the calls return 409.

## Commit

`feat: security hardening batch - hashed sessions, rate limits, sandboxing, delete affordances`

## Post-review fixes

Code review found the original spec for `requestIp.ts` was wrong (Important) plus two minors. Addressed as follows:

### Important: XFF must use the LAST hop, not the first

`src/lib/requestIp.ts` originally took `split(",")[0]` — the *first* entry in `X-Forwarded-For`. That's wrong for a proxy chain where Caddy *appends* the connecting peer's address as the trailing entry rather than stripping/overwriting the inbound header: any earlier hop, including a synthetic first entry, is fully attacker-controlled. A client could send `X-Forwarded-For: <anything>` (or a fresh random value on every request) and have it land as entry #1, minting a brand-new rate-limit bucket per request and defeating the login/signup/explain limits entirely.

Fixed to take the **last** hop — the one Caddy itself appended — and trim it. Also folded in the reviewed empty-string edge case: a present-but-empty header, or an empty last hop after trimming (e.g. `"1.2.3.4, "`), now falls back to `"local"` instead of returning `""` as a bucket key (`src/lib/requestIp.ts:4-16`).

**Test evidence**: new `src/lib/requestIp.test.ts` (6 tests, TDD) — single hop unchanged; spoofed multi-hop `"1.2.3.4, 5.6.7.8"` buckets by `"5.6.7.8"` (not `"1.2.3.4"`); trims whitespace around the last hop; absent header → `"local"`; empty header → `"local"`; empty last hop after trim → `"local"`. The existing login/signup/explain route tests use single-value `x-forwarded-for` headers (e.g. `"9.9.9.9"`), so they were unaffected by the last-vs-first change and needed no edits.

### Minor: DeleteGameButton ignored the DELETE response

`src/components/DeleteGameButton.tsx` previously called `window.location.reload()` unconditionally after `fetch`, regardless of whether the delete actually succeeded (e.g. a 404 from a race, a 500, a network blip) — silently reloading a page that still has the "deleted" game in it, with no feedback that anything went wrong.

Fixed: on `res.ok`, reload as before. On failure, the button now shows "Delete failed" (styled the same as the armed "Confirm delete" state) for 4s via `setTimeout`, then reverts to "Delete" — no `alert()`/`confirm()` dialogs, consistent with the rest of the two-step-confirm UX. Implementation composes the existing `useTwoStepConfirm` hook's `action` callback with a local `failed` state + its own cleanup-tracked timer (`DeleteGameButton.tsx:5-20`).

**Test evidence**: new `src/components/DeleteGameButton.test.tsx` (2 tests, jsdom + Testing Library, mirroring the existing `ExplainButton.test.tsx` pattern) — first click arms confirmation without calling `fetch`; second click on a mocked `ok: true` response calls `DELETE /api/games/g1` then `window.location.reload()`; second click on a mocked `ok: false` response shows "Delete failed" and never calls `reload()`. This closes what was previously an explicitly-listed coverage gap (UI two-step confirms had no automated test) for this one component — `FamousGameForm`'s delete row remains untested per the original scope (no existing test file to extend, still no e2e coverage for the admin famous-games list).

**Verification after fixes**: `npm test` — **118/118 passed** (21 test files; 110 from the first pass + 6 `requestIp` + 2 `DeleteGameButton`). `npm run lint` — 0 errors, 4 warnings, all pre-existing and unrelated to this batch (confirmed my new `DeleteGameButton.test.tsx` introduced two warnings on first pass — an unused `eslint-disable` and an unused `beforeEach` import — both removed). `npm run build` — succeeds, same 17 routes, no new type errors.

**Commit**: a follow-up commit on the same branch, message: `fix: trust only the last X-Forwarded-For hop; handle failed game deletes`.
