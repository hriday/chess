import type { ParsedMove } from "./parse";

export type Verdict = "best" | "good" | "inaccuracy" | "mistake" | "blunder";

export type MoveEval = {
  evalBefore: number;
  evalAfter: number;
  bestMoveSan: string | null;
  bestLine: string[];
  /** Search quality behind this eval. Absent means "unknown/legacy" and is
   * treated like "shallow" by anything that cares (nothing currently does:
   * verdict/commentary/UI all read evals quality-agnostically). */
  quality?: "shallow" | "deep";
};

export const MATE_BASE = 100000;

export const VERDICT_META: Record<Verdict, { label: string; symbol: string; color: string }> = {
  best:       { label: "Best move",  symbol: "!",  color: "text-emerald-500" },
  good:       { label: "Good move",  symbol: "",   color: "text-slate-400" },
  inaccuracy: { label: "Inaccuracy", symbol: "?!", color: "text-yellow-500" },
  mistake:    { label: "Mistake",    symbol: "?",  color: "text-orange-500" },
  blunder:    { label: "Blunder",    symbol: "??", color: "text-red-500" },
};

export function classifyMove(move: ParsedMove, ev: MoveEval): Verdict {
  const loss = Math.max(0,
    move.color === "w" ? ev.evalBefore - ev.evalAfter : ev.evalAfter - ev.evalBefore);
  if (ev.bestMoveSan === move.san || loss < 20) return "best";
  if (loss < 50) return "good";
  if (loss < 100) return "inaccuracy";
  if (loss < 200) return "mistake";
  return "blunder";
}

export function formatEval(cp: number): string {
  if (Math.abs(cp) > MATE_BASE - 1000) {
    const n = MATE_BASE - Math.abs(cp);
    return cp > 0 ? `#${n}` : `#-${n}`;
  }
  const pawns = cp / 100;
  return pawns > 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
}

export function evalWords(cp: number): string {
  if (Math.abs(cp) > MATE_BASE - 1000) {
    const n = MATE_BASE - Math.abs(cp);
    return cp > 0 ? `White mates in ${n}` : `Black mates in ${n}`;
  }
  const abs = Math.abs(cp);
  if (abs < 30) return "Level";
  const side = cp > 0 ? "White" : "Black";
  if (abs < 100) return `${side} slightly better`;
  if (abs < 300) return `${side} better`;
  return `${side} winning`;
}

export function commentaryFor(move: ParsedMove, ev: MoveEval, verdict: Verdict): string {
  const num = move.color === "w" ? `${move.moveNumber}.` : `${move.moveNumber}...`;
  const played = `${num} ${move.san}`;
  const lossPawns = (Math.max(0,
    move.color === "w" ? ev.evalBefore - ev.evalAfter : ev.evalAfter - ev.evalBefore) / 100).toFixed(1);
  const line = ev.bestLine.length > 1 ? ` after which ${ev.bestLine.slice(0, 4).join(" ")} keeps the fight going` : "";

  switch (verdict) {
    case "best":
      return `${played} is the engine's top choice here (${formatEval(ev.evalAfter)}).`;
    case "good":
      return `${played} is a solid move; the position stays around ${formatEval(ev.evalAfter)}.`;
    case "inaccuracy":
      return `${played} is an inaccuracy, giving up ${lossPawns} pawns of advantage.` +
        (ev.bestMoveSan && ev.bestMoveSan !== move.san ? ` Better was ${ev.bestMoveSan}${line}.` : "");
    case "mistake":
      return `${played} is a mistake, losing ${lossPawns} pawns of advantage.` +
        (ev.bestMoveSan && ev.bestMoveSan !== move.san ? ` Better was ${ev.bestMoveSan}${line}.` : "");
    case "blunder":
      return `${played} is a blunder, throwing away ${lossPawns} pawns.` +
        (ev.bestMoveSan && ev.bestMoveSan !== move.san ? ` Better was ${ev.bestMoveSan}${line}.` : "");
  }
}
