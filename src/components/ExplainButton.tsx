"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import { classifyMove } from "@/lib/chess/classify";

type PlyStatus = { error?: string; needsLogin?: boolean; busy?: boolean };

export function ExplainButton() {
  const { game, gameId, currentPly, evals, meta, annotations } = useGameStore();
  const [cache, setCache] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<Record<number, PlyStatus>>({});

  useEffect(() => { setCache({}); setStatus({}); }, [game]);

  if (!game || currentPly < 0 || !evals[currentPly]) return null;
  if (annotations[currentPly]?.llm) return null;
  const move = game.moves[currentPly];
  const ev = evals[currentPly];
  const ply = currentPly;
  const text = cache[ply];
  const plyStatus = status[ply];

  const explain = async () => {
    setStatus((s) => ({ ...s, [ply]: { busy: true } }));
    // Cap at the last 60 SAN so the prompt stays bounded for long games;
    // startPly records where that tail begins so the movetext can still be
    // numbered correctly (e.g. "16... Qd7 17. Nf3 ..." instead of "1. Qd7 ...").
    const allMoves = game.moves.slice(0, ply + 1).map((m) => m.san);
    const movesSoFar = allMoves.length > 60 ? allMoves.slice(-60) : allMoves;
    const startPly = allMoves.length - movesSoFar.length;
    const res = await fetch("/api/explain", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fen: game.positions[ply], san: move.san,
        moveNumber: move.moveNumber, color: move.color,
        evalBefore: ev.evalBefore, evalAfter: ev.evalAfter,
        bestMoveSan: ev.bestMoveSan, bestLine: ev.bestLine,
        title: meta?.title ?? "Imported game",
        movesSoFar, startPly, verdict: classifyMove(move, ev),
        ...(gameId ? { gameId, ply } : {}),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setCache((c) => ({ ...c, [ply]: body.text }));
      setStatus((s) => ({ ...s, [ply]: {} }));
    } else {
      setStatus((s) => ({ ...s, [ply]: { error: body.error ?? "Failed", needsLogin: res.status === 401 || res.status === 402 } }));
    }
  };

  return (
    <div className="mt-3 border-t border-black/10 dark:border-white/15 pt-3">
      {text ? (
        <p className="text-sm leading-relaxed rounded bg-indigo-500/10 p-3">{text}</p>
      ) : plyStatus?.error ? (
        <p className="text-sm text-red-500">
          {plyStatus.error}{plyStatus.needsLogin && <> — <Link className="underline" href="/login">log in</Link></>}
        </p>
      ) : (
        <button onClick={explain} disabled={plyStatus?.busy}
          className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">
          {plyStatus?.busy ? "Thinking…" : "✨ Explain this move"}
        </button>
      )}
    </div>
  );
}
