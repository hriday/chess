import { Chess } from "chess.js";

export const stripSanSuffix = (san: string) => san.replace(/[+#]+$/, "");

/**
 * Resolves a SAN move (as produced by the engine or a stored line) to its
 * from/to squares against a given FEN, by matching it against chess.js's
 * legal verbose move list. Tolerant of missing/extra check (+) and mate (#)
 * suffixes on either side. Returns null if the FEN can't be loaded or the
 * SAN doesn't match any legal move.
 */
export function sanToFromTo(fen: string, san: string): { from: string; to: string } | null {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return null;
  }
  const target = stripSanSuffix(san);
  const move = chess.moves({ verbose: true }).find(m => stripSanSuffix(m.san) === target);
  return move ? { from: move.from, to: move.to } : null;
}
