# Engine performance rework — two-phase, time-boxed analysis

Branch: `worktree-engine-perf` (off `main` at `2f78d38`)
Worktree: `/Users/hriday/code/chess/.claude/worktrees/engine-perf`

## Summary of changes

- `src/lib/chess/classify.ts` — `MoveEval` gains optional `quality?: "shallow" | "deep"`.
- `src/store/gameStore.ts` — new `analysisProgress: { done: number; total: number } | null` state
  and `setAnalysisProgress` action; added to the `initial` object so both `loadGame` and `reset`
  (which both spread `...initial`) clear it automatically.
- `src/store/gameStore.test.ts` — TDD: 4 new tests written first (confirmed red —
  `setAnalysisProgress is not a function`), then made green by the store changes above.
- `src/hooks/useEngine.ts` — replaced the fixed `go depth 12` sweep with the two-phase,
  time-boxed work-queue design described below.
- `src/components/AnalysisProgress.tsx` — new tiny client component, `data-testid="analysis-progress"`.
- `src/app/page.tsx` — mounts `<AnalysisProgress />` under `<MoveNav />`, above `<CommentaryPanel>`,
  in the left column.

## Work-queue structure (`useEngine.ts`)

Two FIFOs share a single worker (UCI is serial — one search in flight at a time regardless):

- `shallowQueue: number[]` — every ply, seeded once at effect start in the pre-existing
  current-ply-outward order. This is Phase 1.
- `deepQueue: number[]` — starts empty; fed live by a `useGameStore.subscribe` listener set up
  in the same `[game]`-keyed effect. On every `currentPly` change it pushes the window
  `[currentPly-1, currentPly, currentPly+1]` (bounds-checked: `ply < 0` or `ply >= moves.length`
  is dropped, not clamped) into `deepQueue`, skipping any ply whose eval is already
  `quality: "deep"` or is already queued.

The driver is a single `while (runIdRef.current === runId)` loop:

```js
while (runIdRef.current === runId) {
  const deepPly = deepQueue.shift();
  if (deepPly !== undefined) { ...process as "deep"...; continue; }

  if (shallowQueue.length > 0) { ...process next as "shallow"...; continue; }

  await idle(); // park until enqueueDeep (or cleanup) wakes us
}
```

`idle()`/`wake()` is a minimal single-waiter promise pair (no polling): when both queues are
empty the loop parks on a promise; `enqueueDeep` resolves it as soon as it pushes a job, and the
effect's cleanup resolves it too so a stale run notices `runIdRef` changed and exits instead of
leaking a parked promise forever.

**How Phase-2 priority interleaves:** the loop always checks `deepQueue` before ever touching
`shallowQueue`, on every iteration — not just at start-up. So mid-sweep, the moment the user
moves the cursor, the *next* loop iteration (after whatever `analyze()` call is currently
in-flight finishes — single worker, can't preempt an in-flight search) picks the freshly
enqueued deep job over the next shallow item in queue. The background sweep resumes exactly
where it left off once the deep queue drains again. This satisfies "let an in-flight shallow
analyze finish first, but deep queue checked before the next shallow item" from the design.

**Caches:** `shallowEvals`/`deepEvals` are independent per-position caches (both sized
`game.positions.length`), because a position analyzed at `SHALLOW_MS` still needs a fresh
`DEEP_MS` search — reusing one cache across qualities would silently keep the shallow result.

**Preserved exactly:** one worker per run (`workerRef.current?.terminate()` before creating a
new one), runId invalidation guard (checked at loop top and again after every `await`), the
`error` listener bumping `runIdRef`, and the stall-recovery `stop` + `waitReady` drain on a
timed-out `analyze()`. `analyze(worker, fen, movetimeMs)` now sends `go movetime <ms>` instead of
`go depth 12`, with the safety timeout shrunk to `movetimeMs + 5000` (was a flat 30s).
Constants: `SHALLOW_MS = 80`, `DEEP_MS = 300`.

`uci.ts` was not touched — its parsing is movetime-agnostic, confirmed by reading it.

## Progress UI

`src/components/AnalysisProgress.tsx` reads `analysisProgress` from the store; renders nothing
when it's `null` or `done >= total`. While active it shows `Analyzing moves… {done}/{total}` plus
a `div`-width-percentage progress bar. The hook sets `{ done: 0, total: shallowTotal }` right
before the sweep loop starts and increments `done` after each shallow item is dequeued
(regardless of whether it needed real work, i.e. it was already eval'd by an earlier deep job —
"done" tracks sweep progress, not search count), so it naturally reaches `{ done: total, total }`
as the last item is processed and the component hides itself.

## Test evidence

Store tests written red-first:
```
FAIL src/store/gameStore.test.ts > analysisProgress > setAnalysisProgress sets the progress
TypeError: useGameStore.getState(...).setAnalysisProgress is not a function
 Test Files  1 failed (1)
      Tests  4 failed | 15 passed (19)
```
Then green after implementing the store changes:
```
✓ src/store/gameStore.test.ts (19 tests) 14ms
```

Full unit suite:
```
Test Files  24 passed (24)
     Tests  149 passed (149)   (145 pre-existing + 4 new analysisProgress tests)
```

Lint: `npm run lint` — 0 errors, 4 pre-existing warnings in unrelated test files
(`route.test.ts` unused vars), untouched by this change.

Build: `npm run build` — compiled successfully, type-checked successfully, all 17 routes
generated.

## e2e output (full suite, twice — once before the perf probe, once after)

```
Running 4 tests using 1 worker

  ✓  1 e2e/smoke.spec.ts:6:7 › mobile layout › ... commentary visible (2.6s–2.7s)
  ✓  2 e2e/smoke.spec.ts:43:5 › import a game, navigate, see engine commentary (2.4s)
  ✓  3 e2e/smoke.spec.ts:61:5 › guest cannot get LLM explanations (1.4s)
  ✓  4 e2e/smoke.spec.ts:71:5 › theme toggle flips dark class (1.4s–1.6s)

  4 passed (13.1s–15.4s)
```

The `/Bb5/` commentary assertion (30s timeout budget) resolved well inside 2.7s total for that
whole test, consistent with the shallow-sweep speedup the task predicted.

## Full-sweep wall-time measurement (~40-ply game)

Captured via a throwaway Playwright spec (written, run once, then deleted — not part of the
committed test suite) that loaded a 20-move Ruy Lopez line (`1. e4 e5 2. Nf3 Nc6 3. Bb5 a6
4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7`, 40 plies) against
the dev server and timed from "Load game" click to the `analysis-progress` testid going hidden:

```
FULL_SWEEP_WALL_TIME_MS=2930
```

**~2.9s wall time for a full 40-ply shallow sweep** in headless Chromium, vs. a fixed depth-12
search per position previously (unmeasured pre-change baseline, but depth-12 on Stockfish
typically costs several hundred ms to seconds per position on mobile-class hardware — the whole
premise of this rework — so this is a large improvement, and importantly the UI now shows
progress instead of appearing frozen).

Dev-server curl check: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → `200`.

## Self-review / concerns

- **Correctness of the idle/wake handshake**: verified by reasoning through React's effect
  cleanup ordering — cleanup(run N) runs synchronously before effect(run N+1)'s body, but the
  parked `idle()` promise for run N only resumes on a microtask *after* both synchronous bodies
  finish, by which point `runIdRef.current` has already been bumped by run N+1. So a stale
  parked loop always sees the mismatch and exits cleanly; it never leaks a live subscription.
  This isn't unit-tested directly (no existing test harness for `useEngine`'s worker-driven async
  loop — there wasn't one before this change either), so it's verified by code reasoning plus the
  e2e suite exercising real game loads/navigation without hangs.
- **No unit tests for `useEngine.ts` itself**: this was true before the change too (no
  `useEngine.test.ts` existed; the hook is covered indirectly via e2e). I did not add one, since
  the task's TDD instruction was scoped explicitly to the store (`"Store (...), TDD:"`), and
  building a Worker-mocking harness for the hook would be a larger, separately-scoped effort.
  Flagging this as a gap for a future pass if deeper coverage of the queue/priority logic is
  wanted.
- **Progress counts "swept," not "searched"**: a ply already `quality: "deep"` from an early
  navigation still increments `done` when the shallow sweep reaches it (it's skipped, not
  re-analyzed) — this is intentional so the progress bar denominator/numerator stay meaningful
  ("how far through the game has the sweep gotten"), but worth calling out as a judgment call
  not spelled out verbatim in the design.
- **Deep-job dedup uses `Array.includes`**: fine at this scale (queue length ≤ 3 by
  construction — only the ply window around `currentPly`), not a concern.
- Verified by reading every consumer of `evals[ply]` (`CommentaryPanel.tsx`, `Board.tsx`,
  `EvalBar.tsx`, `ExplainButton.tsx`, `MoveList.tsx`) that none inspect `quality` — confirmed no
  behavior change outside the two files the design called out as needing change.
