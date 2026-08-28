"use client";
import { useGameStore } from "@/store/gameStore";
import { evalWords, formatEval } from "@/lib/chess/classify";

export function EvalBar() {
  const { game, currentPly, evals } = useGameStore();
  const ev = currentPly >= 0 ? evals[currentPly] : undefined;
  const cp = ev ? ev.evalAfter : 0;
  const whitePct = 50 + Math.max(-500, Math.min(500, cp)) / 10;
  return (
    <div className="flex flex-col items-center gap-1 w-8 shrink-0 self-stretch" aria-label="evaluation">
      <div className="flex-1 w-4 rounded overflow-hidden bg-neutral-800 flex flex-col">
        <div className="bg-neutral-800 transition-all" style={{ height: `${100 - whitePct}%` }} />
        <div className="bg-neutral-100 transition-all" style={{ height: `${whitePct}%` }} />
      </div>
      <span className="text-xs font-mono">{game && ev ? formatEval(cp) : "–"}</span>
      {game && ev && (
        <span className="hidden sm:block text-[10px] opacity-70 text-center leading-tight">
          {evalWords(cp)}
        </span>
      )}
    </div>
  );
}
