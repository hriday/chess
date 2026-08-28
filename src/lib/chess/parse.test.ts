import { describe, it, expect } from "vitest";
import { parseGame, gameMeta, ParseError } from "@/lib/chess/parse";

const PGN = `[Event "Casual"]
[White "Morphy"]
[Black "Allies"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 1-0`;

describe("parseGame", () => {
  it("parses PGN with headers", () => {
    const g = parseGame(PGN);
    expect(g.headers.White).toBe("Morphy");
    expect(g.moves).toHaveLength(6);
    expect(g.moves[0]).toMatchObject({ san: "e4", color: "w", ply: 0, moveNumber: 1 });
    expect(g.moves[3]).toMatchObject({ san: "d6", color: "b", ply: 3, moveNumber: 2 });
    expect(g.positions).toHaveLength(7);
    expect(g.positions[0]).toContain("rnbqkbnr/pppppppp");
  });
  it("parses a bare numbered move list", () => {
    expect(parseGame("1. e4 e5 2. Nf3").moves.map(m => m.san)).toEqual(["e4", "e5", "Nf3"]);
  });
  it("parses a bare unnumbered move list", () => {
    expect(parseGame("e4 e5 Nf3 Nc6").moves).toHaveLength(4);
  });
  it("throws ParseError on garbage", () => {
    expect(() => parseGame("hello world this is not chess")).toThrow(ParseError);
    expect(() => parseGame("1. e4 e5 2. Zz9")).toThrow(ParseError);
  });
  it("extracts meta", () => {
    expect(gameMeta(parseGame(PGN))).toEqual({
      title: "Morphy – Allies", whitePlayer: "Morphy", blackPlayer: "Allies", result: "1-0" });
    expect(gameMeta(parseGame("1. e4")).title).toBe("Imported game");
  });
});
