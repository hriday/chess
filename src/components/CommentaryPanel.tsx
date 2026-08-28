"use client";
import type { ReactNode } from "react";
import { useGameStore } from "@/store/gameStore";
import { classifyMove, commentaryFor, evalWords, formatEval, VERDICT_META } from "@/lib/chess/classify";
import { buildPreviewFens } from "@/lib/chess/preview";

const NEEDS_BETTER_LINE = new Set(["inaccuracy", "mistake", "blunder"]);

export function CommentaryPanel({ children }: { children?: ReactNode }) {
  const { game, currentPly, evals, preview, startPreview, stepPreview, endPreview } = useGameStore();
  if (!game) return null;

  if (preview) {
    const atStart = preview.step <= 0;
    const atEnd = preview.step >= preview.fens.length - 1;
    return (
      <section data-testid="commentary"
        className="rounded-lg border border-black/10 dark:border-white/15 p-4 min-h-28">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-indigo-500">{preview.label}</span>
          <span className="font-mono text-xs opacity-70">{preview.step}/{preview.fens.length - 1}</span>
          <div className="flex gap-1 ml-auto">
            <button
              aria-label="preview step back"
              className="px-2 py-1 rounded bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 disabled:opacity-40"
              onClick={() => stepPreview(-1)}
              disabled={atStart}
            >◀</button>
            <button
              aria-label="preview step forward"
              className="px-2 py-1 rounded bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 disabled:opacity-40"
              onClick={() => stepPreview(1)}
              disabled={atEnd}
            >▶</button>
            <button
              className="px-2 py-1 rounded bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-sm"
              onClick={endPreview}
            >✕ Back to game</button>
          </div>
        </div>
        {children}
      </section>
    );
  }

  let body: ReactNode;
  if (currentPly < 0) {
    body = <p className="opacity-70">Start of game — step forward to begin.</p>;
  } else {
    const move = game.moves[currentPly];
    const ev = evals[currentPly];
    if (!ev) {
      body = <p className="opacity-70 animate-pulse">Analyzing…</p>;
    } else {
      const verdict = classifyMove(move, ev);
      const meta = VERDICT_META[verdict];
      const canPreview = NEEDS_BETTER_LINE.has(verdict) && ev.bestLine.length > 0;
      body = (
        <div className="space-y-2">
          <p className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold ${meta.color}`}>{meta.label} {meta.symbol}</span>
            <span className="font-mono text-sm opacity-70">{formatEval(ev.evalAfter)} · {evalWords(ev.evalAfter)}</span>
          </p>
          <p className="text-sm leading-relaxed">{commentaryFor(move, ev, verdict)}</p>
          {canPreview && (
            <button
              data-testid="preview-line"
              className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700"
              onClick={() => {
                const fens = buildPreviewFens(game.positions[currentPly], ev.bestLine);
                startPreview(fens, `Better: ${ev.bestLine.slice(0, 3).join(" ")}…`);
              }}
            >▶ Preview better line</button>
          )}
        </div>
      );
    }
  }

  return (
    <section data-testid="commentary"
      className="rounded-lg border border-black/10 dark:border-white/15 p-4 min-h-28">
      {body}
      {children}
    </section>
  );
}
