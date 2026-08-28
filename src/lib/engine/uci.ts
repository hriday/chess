import { Chess } from "chess.js";
import { MATE_BASE } from "@/lib/chess/classify";

export function parseInfoLine(line: string, whiteToMove: boolean): { cp: number; pv: string[] } | null {
  if (!line.startsWith("info") || !line.includes(" score ")) return null;
  const cpMatch = line.match(/ score cp (-?\d+)/);
  const mateMatch = line.match(/ score mate (-?\d+)/);
  let cp: number;
  if (cpMatch) cp = parseInt(cpMatch[1], 10);
  else if (mateMatch) {
    const n = parseInt(mateMatch[1], 10);
    cp = n > 0 ? MATE_BASE - n : -(MATE_BASE + n);
  } else return null;
  if (!whiteToMove) cp = -cp;
  const pvMatch = line.match(/ pv (.+)$/);
  return { cp, pv: pvMatch ? pvMatch[1].trim().split(/\s+/) : [] };
}

export function parseBestMove(line: string): string | null {
  const m = line.match(/^bestmove (\S+)/);
  return m && m[1] !== "(none)" ? m[1] : null;
}

export function uciToSan(fen: string, uci: string[]): string[] {
  const chess = new Chess(fen);
  const sans: string[] = [];
  for (const mv of uci) {
    try {
      const played = chess.move({ from: mv.slice(0, 2), to: mv.slice(2, 4), promotion: mv.slice(4) || undefined });
      sans.push(played.san);
    } catch { break; }
  }
  return sans;
}
