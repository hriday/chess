import { describe, it, expect } from "vitest";
import { parseInfoLine, parseBestMove, uciToSan } from "@/lib/engine/uci";
import { MATE_BASE } from "@/lib/chess/classify";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("parseInfoLine", () => {
  const line = "info depth 12 seldepth 16 score cp 35 nodes 90210 pv e2e4 e7e5 g1f3";
  it("parses cp score and pv (white to move)", () => {
    expect(parseInfoLine(line, true)).toEqual({ cp: 35, pv: ["e2e4", "e7e5", "g1f3"] });
  });
  it("negates for black to move", () => {
    expect(parseInfoLine(line, false)!.cp).toBe(-35);
  });
  it("parses mate scores", () => {
    expect(parseInfoLine("info depth 10 score mate 3 pv d1h5", true)!.cp).toBe(MATE_BASE - 3);
    expect(parseInfoLine("info depth 10 score mate -2 pv a2a3", true)!.cp).toBe(-(MATE_BASE - 2));
  });
  it("ignores non-scoring lines", () => {
    expect(parseInfoLine("info string NNUE evaluation enabled", true)).toBeNull();
    expect(parseInfoLine("bestmove e2e4", true)).toBeNull();
  });
});

describe("parseBestMove", () => {
  it("extracts the move", () => {
    expect(parseBestMove("bestmove e2e4 ponder e7e5")).toBe("e2e4");
    expect(parseBestMove("info depth 5")).toBeNull();
  });
});

describe("uciToSan", () => {
  it("converts uci pv to san from a fen", () => {
    expect(uciToSan(START, ["e2e4", "e7e5", "g1f3"])).toEqual(["e4", "e5", "Nf3"]);
  });
  it("stops at the first illegal move", () => {
    expect(uciToSan(START, ["e2e4", "e2e4"])).toEqual(["e4"]);
  });
});
