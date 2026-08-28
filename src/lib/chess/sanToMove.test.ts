import { describe, it, expect } from "vitest";
import { sanToFromTo } from "@/lib/chess/sanToMove";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

describe("sanToFromTo", () => {
  it("resolves e4 from the start position", () => {
    expect(sanToFromTo(START, "e4")).toEqual({ from: "e2", to: "e4" });
  });

  it("resolves a knight developing move", () => {
    expect(sanToFromTo(AFTER_E4, "Nf6")).toEqual({ from: "g8", to: "f6" });
  });

  it("matches san with check/mate suffixes stripped", () => {
    expect(sanToFromTo(START, "e4+")).toEqual({ from: "e2", to: "e4" });
  });

  it("returns null for an illegal san", () => {
    expect(sanToFromTo(START, "Qh5")).toBeNull();
  });

  it("returns null for an unusable fen", () => {
    expect(sanToFromTo("not-a-fen", "e4")).toBeNull();
  });
});
