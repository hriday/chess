import { describe, it, expect } from "vitest";
import { buildExplainPrompt } from "@/lib/llm/explain";

const input = {
  fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
  san: "Bc4", moveNumber: 3, color: "w" as const,
  evalBefore: 30, evalAfter: 25, bestMoveSan: "Bb5", bestLine: ["Bb5", "a6", "Ba4"],
  title: "Morphy – Allies",
  movesSoFar: ["e4", "e5", "Nf3", "Nc6", "Bc4"],
  verdict: "good",
};

describe("buildExplainPrompt", () => {
  it("embeds position, move, evals, verdict, and best line", () => {
    const p = buildExplainPrompt(input);
    expect(p).toContain(input.fen);
    expect(p).toContain("3. Bc4");
    expect(p).toContain("+0.3");   // evalBefore formatted
    expect(p).toContain("Bb5 a6 Ba4");
    expect(p).toContain("Morphy – Allies");
    expect(p).toContain("Verdict: good");
  });

  it("renders moves so far as a numbered movetext line", () => {
    const p = buildExplainPrompt(input);
    expect(p).toContain("Moves so far: 1. e4 e5 2. Nf3 Nc6 3. Bc4");
  });

  it("numbers black moves with ellipsis", () => {
    expect(buildExplainPrompt({ ...input, color: "b" })).toContain("3... Bc4");
  });

  it("starts movetext numbering from startPly for a truncated tail beginning on black", () => {
    // Tail starts at ply 31 (0-indexed) = move 16, black to move.
    const p = buildExplainPrompt({ ...input, movesSoFar: ["Qd7", "Nf3", "Nc6"], startPly: 31 });
    expect(p).toContain("Moves so far: 16... Qd7 17. Nf3 Nc6");
  });

  it("starts movetext numbering from startPly for a truncated tail beginning on white", () => {
    // Tail starts at ply 30 (0-indexed) = move 16, white to move.
    const p = buildExplainPrompt({ ...input, movesSoFar: ["Nf3", "Nc6"], startPly: 30 });
    expect(p).toContain("Moves so far: 16. Nf3 Nc6");
  });

  it("omits the moves-so-far line when there are none", () => {
    const p = buildExplainPrompt({ ...input, movesSoFar: [] });
    expect(p).not.toContain("Moves so far:");
  });
});
