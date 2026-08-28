# Readability batch — implementation report

Branch: `worktree-readability` off `main` @ `cd5dca9`. Worked in
`/Users/hriday/code/chess/.claude/worktrees/readability`.

## Feature 1 — Playable variation previews

- `src/lib/chess/preview.ts:9` — `buildPreviewFens(baseFen, sanLine)`, pure chess.js replay.
  Tests: `src/lib/chess/preview.test.ts` (normal line, illegal-tail truncation, empty line,
  unusable base FEN — 4 tests, all green).
- `src/store/gameStore.ts:17` — new `preview: PreviewState | null` field
  (`{ fens, step, label }`), actions `startPreview` (`:55`), `stepPreview` (`:56-60`, clamped
  `[0, fens.length-1]`), `endPreview` (`:61`). `currentFen` (`:65`) now takes
  `Pick<GameState, "game" | "currentPly" | "preview">` and returns `preview.fens[step]` when a
  preview is active. `goTo` (`:47`) clears `preview: null` explicitly; `next`/`prev` delegate to
  `goTo` so they clear it too; `loadGame` and `reset` spread `initial`, which now includes
  `preview: null`. Tests in `src/store/gameStore.test.ts` (`describe("preview", …)`, 9 new
  tests) cover all of the above, including "goTo/next/prev/loadGame/reset clear preview".
- `src/components/CommentaryPanel.tsx:67` — `data-testid="preview-line"` button, shown only
  when `NEEDS_BETTER_LINE.has(verdict)` (inaccuracy/mistake/blunder) and `ev.bestLine.length >
  0`. On click, builds fens from `buildPreviewFens(game.positions[currentPly], ev.bestLine)`
  and calls `startPreview(fens, `Better: ${bestLine.slice(0,3).join(" ")}…`)`. Lines `:12-45`
  render the compact preview bar (label, `step/max` counter, `◀`/`▶` step buttons disabled at
  the ends, "✕ Back to game") in place of the verdict block while `preview` is active;
  `children` (AnnotationDisplay, ExplainButton) still render underneath in both modes.
- `src/components/MoveNav.tsx:11-19` — keyboard handler checks `preview` after the form-field
  guard and routes `ArrowLeft`/`ArrowRight` to `stepPreview(∓1)` instead of `prev`/`next` when
  a preview is active.
- `src/components/Board.tsx:25` — `ring-2 ring-indigo-500` applied to the board wrapper
  (`data-testid="board"`) whenever `preview` is truthy.

**Preview-start-step decision:** `startPreview` sets `step: Math.min(1, fens.length - 1)`
(`src/store/gameStore.ts:55`), i.e. it starts one step past the base position. `fens[0]` is
just the position the user is already looking at (identical to the current board before
clicking "Preview better line"), so starting there would show no visible change. Starting at
step 1 means the first move of the engine's line is immediately visible on click, which is
what "immediately visible" in the spec calls for. This is asserted directly in
`gameStore.test.ts` ("startPreview begins at step 1 so the first preview move is immediately
visible") and documented in a comment above `startPreview`.

## Feature 2 — Arrows on the board

- `src/lib/chess/sanToMove.ts:12` — `sanToFromTo(fen, san)`: loads the FEN with chess.js,
  generates legal verbose moves, matches by SAN with `+`/`#` suffixes stripped from both sides,
  returns `{from, to}` or `null`. Tests in `sanToMove.test.ts` (5 tests: e4 from start, Nf6
  developing move, suffix-stripped match, illegal SAN → null, unusable FEN → null).
- `src/components/Board.tsx:11-19` — `customArrows` built only when `!preview && currentPly >=
  0`: amber arrow (`rgb(217, 119, 6)`) for the played move (`move.from`/`move.to` straight from
  `ParsedMove`), plus a green arrow (`rgb(22, 163, 74)`) from `sanToFromTo(positions[currentPly],
  bestMoveSan)` when an eval exists and the engine's move differs from what was played. No
  arrows during preview or at ply −1 (guarded by the same condition).

**Arrow prop adaptation:** none needed for the tuple shape — `node_modules/react-chessboard/
dist/chessboard/types/index.d.ts:36` defines `export type Arrow = [Square, Square, string?]`,
matching the spec's `[from, to, color]` exactly, and `customArrows?: Arrow[]` on the props type
(`:88`) is a direct prop. The only wrinkle: `Arrow`/`Square` aren't re-exported from the
package root (`dist/chessboard/index.d.ts` only exports `SparePiece`, `ChessboardDnDProvider`,
`Chessboard`), so I import the types from the concrete subpath
`react-chessboard/dist/chessboard/types` (`Board.tsx:3`) and cast our plain `string` square
values (`ParsedMove.from`/`to`, `sanToFromTo`'s return) to `Square` at the two push sites
(`Board.tsx:14,18`) since they're runtime-validated chess.js squares already. `npm run build`
type-checks clean with this.

## Feature 3 — Plain-language-first coach prompt

New `SYSTEM` in `src/lib/llm/explain.ts:12-16` (verbatim):

```
You are an experienced chess coach in a one-on-one lesson with a promising student who is reviewing their own game. Your student is an improving player who cannot yet visualize move sequences from notation alone - they need the idea in plain words before they can picture the position. Speak to them directly - warm but exacting - and never fill space with generic filler like "this is an interesting position" or with empty praise.

For every move, lead with the idea in plain words, and put algebraic notation in parentheses right after the idea it names - for example, "the knight retreat (Nf6) shields your weakest pawn (f7)," not "Nf6 shields f7." Name the actual squares, pieces, threats, and pawn-structure features involved, not a vague description, but always name them through the idea, with the notation trailing in parentheses as a label, never leading. When the engine prefers a different move, name that move the same way, describe the plan behind it in words, and, if it helps prove the point, quote at most one variation of at most three moves to show why it is stronger - point at what those moves accomplish rather than reciting a longer line. Express evaluations in words - "White is better by about a pawn," "the position is level," "Black is winning" - and you may add the number afterward in parentheses, but never state a bare number on its own. Close with one transferable principle the student should carry into future games, stated plainly in a single clause.

Match your register to the verdict: for a blunder, be direct about exactly what was missed and why it matters, with no hedging; for a mistake or inaccuracy, name precisely what separates the played move from the best one; for a good or best move, say what made the idea work and what to look for so the student can find it again on their own. Never soften or contradict the engine's evaluation - if the position swung, say so plainly. Write four to seven sentences of plain prose: no headings, no bullet points, no hedging.
```

Kept persona (experienced coach, one-on-one, direct/warm register), the four-to-seven-sentence
plain-prose close, the register-matches-verdict rule, and "never soften the engine's
evaluation." Added: plain-language-leads-notation-follows rule with the worked example from the
spec; one-variation/three-move cap; words-first evaluation phrasing with numbers only as an
optional parenthetical; and an explicit audience sentence up front ("cannot yet visualize move
sequences from notation alone").

`explain.test.ts` needed **no changes** — its assertions are all against
`buildExplainPrompt`'s embedded data (FEN, move text, formatted evals, best line, title,
verdict), none of which reference SYSTEM phrasing. `src/app/api/explain/route.test.ts` mocks
`explainMove` entirely and likewise asserts nothing about SYSTEM text. Both files still pass
unmodified (6 + 14 tests).

## Feature 4 — Worded evals

- `src/lib/chess/classify.ts:41-51` — `evalWords(cp)`: mate → `"White/Black mates in N"`;
  `|cp| < 30` → `"Level"`; `< 100` → `"White/Black slightly better"`; `< 300` →
  `"White/Black better"`; `≥ 300` → `"White/Black winning"`. 6 new `describe("evalWords", …)`
  blocks in `classify.test.ts` cover every band, both signs, and both mate directions (18
  assertions).
- `src/components/EvalBar.tsx:17-21` — worded label under the numeric one:
  `hidden sm:block text-[10px] opacity-70 text-center leading-tight`. Judgment call: the bar is
  a fixed `w-8` (32px) column, so on mobile ("no horizontal overflow" e2e requirement) the
  worded phrase would either overflow or force wrapping/height changes; I hid it below `sm` and
  kept it on wider viewports where there's room to wrap onto 2-3 lines without affecting the
  bar's own width. This does mean a phone user only sees the number, not the words — the
  numeric label with the ± sign is still legible on its own and doesn't regress anything that
  existed before.
- `src/components/CommentaryPanel.tsx:59` — verdict row now renders
  `{formatEval(ev.evalAfter)} · {evalWords(ev.evalAfter)}` (e.g. `"+1.3 · White better"`).

## Test evidence

`npm test` — 23 files, **142/142 passed** (118 pre-existing + 24 new: 4 preview.ts, 5
sanToMove.ts, 9 gameStore preview, 6 classify evalWords).

```
 Test Files  23 passed (23)
      Tests  142 passed (142)
```

`npm run lint` — 0 errors, 4 pre-existing warnings in `route.test.ts` files (unused mock vars,
unrelated to this batch).

`npm run build` — compiles, type-checks, and generates all 17 routes successfully (confirms the
`Arrow`/`Square` subpath import and casts type-check cleanly).

`npm run e2e` — **4/4 passed**:
```
  ✓  1 e2e/smoke.spec.ts:6:7 › mobile layout › no horizontal overflow, board and nav usable, commentary visible (1.8s)
  ✓  2 e2e/smoke.spec.ts:43:5 › import a game, navigate, see engine commentary (1.4s)
  ✓  3 e2e/smoke.spec.ts:61:5 › guest cannot get LLM explanations (1.4s)
  ✓  4 e2e/smoke.spec.ts:71:5 › theme toggle flips dark class (1.4s)

  4 passed (13.6s)
```
The `/Bb5/` assertion in test 2 still passes because `commentaryFor`'s output (which contains
the move SAN) is only replaced by the preview bar when `preview` is active — clicking a move
in `MoveList` (`goTo`) always clears any prior preview, so the normal flow the e2e test exercises
never sees the preview bar.

Dev-server curl check: `npm run dev` backgrounded, `curl -s -o /dev/null -w "%{http_code}"
http://localhost:3000/` → `200`, page HTML confirmed valid (`<!DOCTYPE html>…`). Server killed
after the check.

## Self-review

- Contracts preserved: `useGameStore` shape is additive only (`preview` + 3 new actions);
  `currentFen`'s signature widened (added `preview` to the `Pick`) but its only caller
  (`Board.tsx`) passes the full store state, so no other call site needed updating (verified by
  grep). `classifyMove`/`formatEval`/`VERDICT_META`/`commentaryFor` untouched; `evalWords` is
  additive. `MoveNav`'s form-field guard still runs first, before the preview branch.
- `data-ply`/`bg-amber` highlighting in `MoveList.tsx` untouched and unaffected by preview
  (preview doesn't change `currentPly`).
- Considered whether `ExplainButton`/`AnnotationDisplay` should be hidden during preview since
  they operate on the real `currentPly`/`evals`, not the preview state — left them visible
  (spec only says the verdict block is replaced by the preview bar; hiding annotations while
  previewing would remove information without being asked to).
- `sanToFromTo` and `buildPreviewFens` both fail closed (return `null` / `[baseFen]`) rather
  than throwing, so a corrupted eval (e.g. a stale/mismatched `bestMoveSan`) degrades to "no
  arrow" / "no preview" instead of crashing the panel.

## Concerns

- `EvalBar`'s worded label is hidden below the `sm` breakpoint per the judgment call above —
  flag if product wants the words visible on mobile too (would need a wider or two-row bar).
- Arrow colors are hardcoded RGB strings picked to read as "amber" and "green" against both
  board themes; no dark/light-specific tuning was done since `customDarkSquareStyle`/
  `customLightSquareStyle` already use CSS vars, not classes, and `customArrows` colors aren't
  theme-reactive without extra plumbing.
- The `▶`/`◀ ` preview step buttons and "✕ Back to game" don't have `data-testid`s beyond the
  panel-level `data-testid="commentary"` and `preview-line`; only what the spec explicitly asked
  to be `data-testid`-addressable (`preview-line`) got one, to avoid inventing contract surface
  the e2e suite doesn't need.

## Fix round — review follow-up

Coordinator review approved the batch with one Important UX gap and one minor, both addressed:

**1. On-screen nav buttons now match keyboard behavior during preview.**
`src/components/MoveNav.tsx:23-24` — `onPrev`/`onNext` resolve to `stepPreview(-1)`/
`stepPreview(1)` when `preview` is truthy, else to the original `prev`/`next`, and the ◀/▶
buttons (`:28-29`) call these instead of `prev`/`next` directly — mirroring the keyboard
handler's existing preview branch (`:11-14`) exactly. ⏮/⏭ (`:27`, `:30`) are untouched: they
still call `goTo(-1)` / `goTo(game.moves.length - 1)`, which clears the preview as a deliberate
"leave the line and jump to the real start/end of the game" action, per the ruling.

A cheap test seam existed (the codebase already mocks `@/store/gameStore` for component tests,
e.g. `ExplainButton.test.tsx`), so I added `src/components/MoveNav.test.tsx` (3 tests, new
file) rather than relying on manual verification:
- "routes ◀/▶ to next/prev when no preview is active" — asserts `stepPreview` is never called.
- "routes ◀/▶ to stepPreview(-1)/stepPreview(1) while previewing" — asserts `prev`/`next` are
  never called and `stepPreview` is called with the right deltas.
- "⏮/⏭ still call goTo (leaving the preview) regardless of preview state" — asserts `goTo(-1)`
  and `goTo(moves.length - 1)` fire even while `preview` is set.

**2. Green-arrow SAN comparison normalized.**
`src/lib/chess/sanToMove.ts:3` — the previously-private `stripSuffix` helper is now exported as
`stripSanSuffix` (`san.replace(/[+#]+$/, "")`), reused at its two existing call sites inside
`sanToFromTo` (`:19-20`). `src/components/Board.tsx:16` now compares
`stripSanSuffix(ev.bestMoveSan) !== stripSanSuffix(move.san)` instead of a raw `!==`, so e.g. a
best move recorded as `"Qh5+"` against a played move recorded as `"Qh5"` (or vice versa) is
correctly treated as the *same* move and no longer draws a spurious green arrow.

### Re-verification after the fix

`npm test` — **24 files, 145/145 passed** (142 prior + 3 new `MoveNav.test.tsx` tests):
```
 Test Files  24 passed (24)
      Tests  145 passed (145)
```
`npm run lint` — 0 errors, same 4 pre-existing unrelated warnings.
`npm run build` — compiles, type-checks, all 17 routes generated.
`npm run e2e` — **4/4 passed** again:
```
  ✓  1 e2e/smoke.spec.ts:6:7 › mobile layout › no horizontal overflow, board and nav usable, commentary visible (1.7s)
  ✓  2 e2e/smoke.spec.ts:43:5 › import a game, navigate, see engine commentary (1.4s)
  ✓  3 e2e/smoke.spec.ts:61:5 › guest cannot get LLM explanations (1.4s)
  ✓  4 e2e/smoke.spec.ts:71:5 › theme toggle flips dark class (1.6s)

  4 passed (13.9s)
```
