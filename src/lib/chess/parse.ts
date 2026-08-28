import { Chess } from "chess.js";

export class ParseError extends Error {}

export type ParsedMove = {
  san: string; from: string; to: string;
  color: "w" | "b"; ply: number; moveNumber: number;
};
export type ParsedGame = {
  headers: Record<string, string>;
  moves: ParsedMove[];
  positions: string[];
};

const RESULTS = new Set(["1-0", "0-1", "1/2-1/2", "*"]);

function fromChess(chess: Chess, headers: Record<string, string>): ParsedGame {
  const verbose = chess.history({ verbose: true });
  if (verbose.length === 0) throw new ParseError("No moves found");
  const positions = [verbose[0].before, ...verbose.map(m => m.after)];
  const moves = verbose.map((m, i) => ({
    san: m.san, from: m.from, to: m.to, color: m.color as "w" | "b",
    ply: i, moveNumber: Math.floor(i / 2) + 1,
  }));
  return { headers, moves, positions };
}

export function parseGame(input: string): ParsedGame {
  const text = input.trim();
  if (!text) throw new ParseError("Empty input");

  if (text.startsWith("[")) {
    const chess = new Chess();
    try {
      chess.loadPgn(text);
    } catch (e) {
      throw new ParseError(e instanceof Error ? e.message : "Invalid PGN");
    }
    return fromChess(chess, chess.getHeaders() as Record<string, string>);
  }

  const tokens = text
    .replace(/\{[^}]*\}/g, " ")
    .split(/\s+/)
    .map(t => t.replace(/^\d+\.(\.\.)?/, ""))
    .filter(t => t && !/^\d+\.?$/.test(t) && !RESULTS.has(t));
  const chess = new Chess();
  for (const tok of tokens) {
    try {
      chess.move(tok);
    } catch {
      throw new ParseError(`Invalid move: "${tok}"`);
    }
  }
  return fromChess(chess, {});
}

export function gameMeta(g: ParsedGame) {
  const white = g.headers.White ?? null;
  const black = g.headers.Black ?? null;
  return {
    title: white && black ? `${white} – ${black}` : "Imported game",
    whitePlayer: white,
    blackPlayer: black,
    result: g.headers.Result && RESULTS.has(g.headers.Result) ? g.headers.Result : null,
  };
}
