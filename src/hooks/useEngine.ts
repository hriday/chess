"use client";
import { useEffect, useRef } from "react";
import { useGameStore } from "@/store/gameStore";
import { parseInfoLine, parseBestMove, uciToSan } from "@/lib/engine/uci";

// Two-phase, time-boxed analysis:
//  - Phase 1 (shallow sweep) analyzes every ply once, quickly, so the whole
//    game gets *some* eval fast (this is what made phones slow: a fixed
//    depth-12 search per position).
//  - Phase 2 (deep refinement) re-analyzes the plies around wherever the
//    user is actually looking, at a higher time budget, on demand.
const SHALLOW_MS = 80;
const DEEP_MS = 300;
const ANALYZE_SAFETY_MARGIN_MS = 5_000;
const READY_TIMEOUT_MS = 5_000;

type Analysis = { cp: number; pv: string[] };
type Quality = "shallow" | "deep";

/**
 * Analyze one FEN for `movetimeMs` (UCI `go movetime`); resolves on
 * bestmove, rejects if it never arrives within movetimeMs + a safety
 * margin (the engine should always answer well within movetimeMs, so the
 * margin only guards against a genuinely stuck worker).
 */
function analyze(worker: Worker, fen: string, movetimeMs: number): Promise<Analysis> {
  const whiteToMove = fen.split(" ")[1] === "w";
  return new Promise((resolve, reject) => {
    let last: Analysis = { cp: 0, pv: [] };
    let settled = false;
    const cleanup = () => {
      worker.removeEventListener("message", onMsg);
      clearTimeout(timer);
    };
    const onMsg = (e: MessageEvent) => {
      const line = String(e.data);
      const info = parseInfoLine(line, whiteToMove);
      if (info) last = info;
      if (parseBestMove(line) !== null || line.startsWith("bestmove")) {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(last);
      }
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("engine timeout"));
    }, movetimeMs + ANALYZE_SAFETY_MARGIN_MS);
    worker.addEventListener("message", onMsg);
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go movetime ${movetimeMs}`);
  });
}

/**
 * Drain the channel after an abandoned search (e.g. one that timed out in
 * analyze() while the engine kept searching in the background): the caller
 * must send "stop" first, then call this. It posts "isready" and resolves
 * once "readyok" comes back — per the UCI spec the engine flushes the
 * abandoned search's bestmove before answering readyok, so any stray
 * bestmove/info lines land on this function's own temporary listener
 * instead of a subsequent analyze() call's listener. Never rejects: a
 * short timeout resolves anyway so a genuinely dead worker can't hang the
 * loop that's waiting on this.
 */
function waitReady(worker: Worker): Promise<void> {
  return new Promise(resolve => {
    let settled = false;
    const cleanup = () => {
      worker.removeEventListener("message", onMsg);
      clearTimeout(timer);
    };
    const onMsg = (e: MessageEvent) => {
      if (String(e.data).startsWith("readyok")) {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      }
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    }, READY_TIMEOUT_MS);
    worker.addEventListener("message", onMsg);
    worker.postMessage("isready");
  });
}

export function useEngine() {
  const game = useGameStore(s => s.game);
  const workerRef = useRef<Worker | null>(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    if (!game) return;
    const runId = ++runIdRef.current;

    // Each run gets its own worker: terminating any prior one kills its
    // stale "message" listeners with it, so a late-arriving bestmove from a
    // previous game/run can never cross-talk into this run's analysis.
    workerRef.current?.terminate();
    const worker = new Worker("/stockfish/stockfish.js");
    workerRef.current = worker;
    worker.postMessage("uci");
    worker.addEventListener("error", () => {
      // The worker crashed outright (distinct from a slow/missing bestmove,
      // which analyze()'s own timeout above handles). We invalidate this
      // run the same way loading a new game would, so the loop below stops
      // issuing further work once its current in-flight analyze() call
      // settles (bounded by that same timeout). Chose this "simple flag"
      // route over rejecting the in-flight analyze() promise directly, to
      // keep the fix minimal and reuse the existing runId guard as the
      // single mechanism for "stop this run".
      runIdRef.current++;
    });

    // ---- Work queue -----------------------------------------------------
    // Two FIFOs share one worker (UCI is single-threaded/serial, so this
    // never means two searches running concurrently — just which one gets
    // dispatched next):
    //   shallowQueue - every ply, current-ply-outward, seeded once up
    //                  front. This is Phase 1: a full first pass so the
    //                  whole game has *an* eval quickly.
    //   deepQueue    - plies around wherever the user is looking right
    //                  now. Empty at first; fed live by the currentPly
    //                  subscription below (Phase 2, "on demand").
    // The loop always drains deepQueue before touching shallowQueue, so
    // navigating the game preempts the background sweep. When both queues
    // are empty the loop parks on idle() until the subscription (or
    // cleanup, on unmount/new game) wakes it.
    const { currentPly: startPly } = useGameStore.getState();
    const shallowQueue: number[] = game.moves.map(m => m.ply)
      .sort((a, b) => Math.abs(a - Math.max(startPly, 0)) - Math.abs(b - Math.max(startPly, 0)));
    const deepQueue: number[] = [];

    let waiter: (() => void) | null = null;
    const wake = () => { const w = waiter; waiter = null; w?.(); };
    const idle = () => new Promise<void>(resolve => { waiter = resolve; });

    const enqueueDeep = (ply: number) => {
      if (ply < 0 || ply >= game.moves.length) return;
      if (useGameStore.getState().evals[ply]?.quality === "deep") return;
      if (deepQueue.includes(ply)) return;
      deepQueue.push(ply);
      wake();
    };

    // Phase 2 trigger: every time currentPly changes, refine the window
    // around it that isn't already "deep" yet.
    const unsubscribe = useGameStore.subscribe((state, prev) => {
      if (state.currentPly === prev.currentPly) return;
      const cp = state.currentPly;
      enqueueDeep(cp - 1);
      enqueueDeep(cp);
      enqueueDeep(cp + 1);
    });

    // Independent per-quality position caches: a position analyzed at
    // SHALLOW_MS still needs a fresh search at DEEP_MS, so "already
    // computed" is tracked separately for each quality level.
    const shallowEvals: (Analysis | null)[] = game.positions.map(() => null);
    const deepEvals: (Analysis | null)[] = game.positions.map(() => null);
    const evalAt = async (i: number, quality: Quality) => {
      const cache = quality === "shallow" ? shallowEvals : deepEvals;
      const ms = quality === "shallow" ? SHALLOW_MS : DEEP_MS;
      if (!cache[i]) cache[i] = await analyze(worker, game.positions[i], ms);
      return cache[i]!;
    };

    const runJob = async (ply: number, quality: Quality) => {
      let before: Analysis;
      let after: Analysis;
      try {
        before = await evalAt(ply, quality);
        after = await evalAt(ply + 1, quality);
      } catch {
        // A stalled/unresponsive position timed out in analyze(), but the
        // engine is likely still searching in the background. Stop it and
        // drain the channel (waitReady) before moving on, so the
        // abandoned search's late bestmove/info lines don't get captured
        // by the next evalAt()'s fresh listener and corrupt that eval.
        worker.postMessage("stop");
        await waitReady(worker);
        return;
      }
      if (runIdRef.current !== runId) return; // a new game was loaded, or the worker errored
      const bestSans = uciToSan(game.positions[ply], before.pv);
      useGameStore.getState().setEval(ply, {
        evalBefore: before.cp,
        evalAfter: after.cp,
        bestMoveSan: bestSans[0] ?? null,
        bestLine: bestSans.slice(0, 6),
        quality,
      });
    };

    (async () => {
      let shallowDone = 0;
      const shallowTotal = shallowQueue.length;
      useGameStore.getState().setAnalysisProgress({ done: 0, total: shallowTotal });

      while (runIdRef.current === runId) {
        const deepPly = deepQueue.shift();
        if (deepPly !== undefined) {
          if (useGameStore.getState().evals[deepPly]?.quality !== "deep") {
            await runJob(deepPly, "deep");
          }
          continue;
        }

        if (shallowQueue.length > 0) {
          const ply = shallowQueue.shift()!;
          if (!useGameStore.getState().evals[ply]) {
            await runJob(ply, "shallow");
          }
          shallowDone++;
          if (runIdRef.current === runId) {
            useGameStore.getState().setAnalysisProgress({ done: shallowDone, total: shallowTotal });
          }
          continue;
        }

        // Nothing left to do right now: the initial sweep is complete and
        // no navigation is pending refinement. Park until enqueueDeep (or
        // this effect's cleanup) wakes us.
        await idle();
      }
    })();

    return () => {
      unsubscribe();
      wake(); // release a parked loop so it can observe the runId change and exit
    };
  }, [game]);

  useEffect(() => () => { workerRef.current?.terminate(); workerRef.current = null; }, []);
}
