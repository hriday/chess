import { describe, it, expect } from "vitest";
import { classifyMove, formatEval, evalWords, commentaryFor, VERDICT_META } from "@/lib/chess/classify";
import type { ParsedMove } from "@/lib/chess/parse";

const wMove: ParsedMove = { san: "Qxb2", from: "d4", to: "b2", color: "w", ply: 10, moveNumber: 6 };
const bMove: ParsedMove = { san: "Qxb2", from: "d4", to: "b2", color: "b", ply: 11, moveNumber: 6 };
const ev = (before: number, after: number, best: string | null = "Nf3") =>
  ({ evalBefore: before, evalAfter: after, bestMoveSan: best, bestLine: ["Nf3", "Nc6"] });

describe("classifyMove", () => {
  it("marks the engine's move best", () => {
    expect(classifyMove({ ...wMove, san: "Nf3" }, ev(50, -10))).toBe("best");
  });
  it("uses mover-relative loss (white)", () => {
    expect(classifyMove(wMove, ev(50, 40))).toBe("best");      // loss 10
    expect(classifyMove(wMove, ev(50, 20))).toBe("good");      // loss 30
    expect(classifyMove(wMove, ev(50, -30))).toBe("inaccuracy"); // loss 80
    expect(classifyMove(wMove, ev(50, -100))).toBe("mistake"); // loss 150
    expect(classifyMove(wMove, ev(50, -260))).toBe("blunder"); // loss 310
  });
  it("uses mover-relative loss (black: eval rising is bad)", () => {
    expect(classifyMove(bMove, ev(-50, 260))).toBe("blunder"); // loss 310 for black
    expect(classifyMove(bMove, ev(50, -50))).toBe("best");     // black gained
  });
});

describe("formatEval", () => {
  it("formats centipawns as pawns", () => {
    expect(formatEval(130)).toBe("+1.3");
    expect(formatEval(-50)).toBe("-0.5");
    expect(formatEval(0)).toBe("0.0");
  });
  it("formats mate scores", () => {
    expect(formatEval(100000 - 4)).toBe("#4");
    expect(formatEval(-(100000 - 3))).toBe("#-3");
  });
});

describe("evalWords", () => {
  it("calls it level within +/-30cp", () => {
    expect(evalWords(0)).toBe("Level");
    expect(evalWords(29)).toBe("Level");
    expect(evalWords(-29)).toBe("Level");
  });
  it("calls it slightly better under 100cp", () => {
    expect(evalWords(30)).toBe("White slightly better");
    expect(evalWords(99)).toBe("White slightly better");
    expect(evalWords(-30)).toBe("Black slightly better");
    expect(evalWords(-99)).toBe("Black slightly better");
  });
  it("calls it better under 300cp", () => {
    expect(evalWords(100)).toBe("White better");
    expect(evalWords(299)).toBe("White better");
    expect(evalWords(-100)).toBe("Black better");
    expect(evalWords(-299)).toBe("Black better");
  });
  it("calls it winning at 300cp or more", () => {
    expect(evalWords(300)).toBe("White winning");
    expect(evalWords(1000)).toBe("White winning");
    expect(evalWords(-300)).toBe("Black winning");
    expect(evalWords(-1000)).toBe("Black winning");
  });
  it("describes mate scores", () => {
    expect(evalWords(100000 - 4)).toBe("White mates in 4");
    expect(evalWords(-(100000 - 3))).toBe("Black mates in 3");
  });
});

describe("commentaryFor", () => {
  it("names the better move on a blunder", () => {
    const text = commentaryFor(wMove, ev(50, -260), "blunder");
    expect(text).toContain("Qxb2");
    expect(text).toContain("blunder");
    expect(text).toContain("Nf3");
  });
  it("praises a best move without suggesting alternatives", () => {
    const text = commentaryFor({ ...wMove, san: "Nf3" }, ev(50, 45), "best");
    expect(text).toContain("Nf3");
    expect(text).not.toContain("Better was");
  });
});

describe("VERDICT_META", () => {
  it("covers all verdicts", () => {
    expect(Object.keys(VERDICT_META).sort()).toEqual(
      ["best", "blunder", "good", "inaccuracy", "mistake"].sort());
    expect(VERDICT_META.blunder.symbol).toBe("??");
  });
});
