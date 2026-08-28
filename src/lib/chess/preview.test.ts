import { describe, it, expect } from "vitest";
import { buildPreviewFens } from "@/lib/chess/preview";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("buildPreviewFens", () => {
  it("replays a normal SAN line from a base FEN", () => {
    const fens = buildPreviewFens(START, ["e4", "e5", "Nf3"]);
    expect(fens).toHaveLength(4);
    expect(fens[0]).toBe(START);
    expect(fens[1]).toContain("4"); // pawn moved to rank 4 somewhere in fen
    expect(fens[3]).not.toBe(START);
  });

  it("stops at the first illegal move, keeping what it built", () => {
    const fens = buildPreviewFens(START, ["e4", "e5", "Zz9", "Nf3"]);
    expect(fens).toHaveLength(3);
    expect(fens[0]).toBe(START);
  });

  it("returns [baseFen] for an empty line", () => {
    const fens = buildPreviewFens(START, []);
    expect(fens).toEqual([START]);
  });

  it("returns [baseFen] when the base FEN itself is unusable", () => {
    const fens = buildPreviewFens("not-a-fen", ["e4"]);
    expect(fens).toEqual(["not-a-fen"]);
  });
});
