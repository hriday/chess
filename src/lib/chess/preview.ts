import { Chess } from "chess.js";

/**
 * Replays a line of SAN moves from a base FEN, returning the FEN before the
 * line and the FEN after each successfully-applied move. If a move in the
 * line is illegal (or the base FEN itself can't be loaded), replay stops
 * there and whatever was built so far is returned — at minimum [baseFen].
 */
export function buildPreviewFens(baseFen: string, sanLine: string[]): string[] {
  let chess: Chess;
  try {
    chess = new Chess(baseFen);
  } catch {
    return [baseFen];
  }
  const fens = [baseFen];
  for (const san of sanLine) {
    try {
      chess.move(san);
    } catch {
      break;
    }
    fens.push(chess.fen());
  }
  return fens;
}
