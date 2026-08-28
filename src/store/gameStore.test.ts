import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore, currentFen } from "@/store/gameStore";
import { parseGame } from "@/lib/chess/parse";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("gameStore", () => {
  beforeEach(() => useGameStore.getState().reset());

  it("starts empty at the initial position", () => {
    const s = useGameStore.getState();
    expect(s.game).toBeNull();
    expect(currentFen(s)).toBe(START);
  });

  it("loads a game at ply -1 and navigates", () => {
    const g = parseGame("1. e4 e5 2. Nf3");
    useGameStore.getState().loadGame(g);
    let s = useGameStore.getState();
    expect(s.currentPly).toBe(-1);
    expect(currentFen(s)).toBe(g.positions[0]);

    s.next();
    s = useGameStore.getState();
    expect(s.currentPly).toBe(0);
    expect(currentFen(s)).toBe(g.positions[1]);

    s.goTo(2);
    expect(useGameStore.getState().currentPly).toBe(2);
    useGameStore.getState().next(); // clamped at last move
    expect(useGameStore.getState().currentPly).toBe(2);
    useGameStore.getState().goTo(-5); // clamped at start
    expect(useGameStore.getState().currentPly).toBe(-1);
    useGameStore.getState().prev();
    expect(useGameStore.getState().currentPly).toBe(-1);
  });

  it("stores evals by ply", () => {
    useGameStore.getState().loadGame(parseGame("1. e4"));
    useGameStore.getState().setEval(0, { evalBefore: 20, evalAfter: 30, bestMoveSan: "e4", bestLine: [] });
    expect(useGameStore.getState().evals[0].evalAfter).toBe(30);
  });

  it("keeps the raw source text", () => {
    useGameStore.getState().loadGame(parseGame("1. e4"), { sourceText: "1. e4" });
    expect(useGameStore.getState().sourceText).toBe("1. e4");
  });

  it("indexes annotations by ply and source", () => {
    useGameStore.getState().loadGame(parseGame("1. e4 e5"), {
      annotations: [
        { ply: 0, source: "admin", text: "The king's pawn." },
        { ply: 0, source: "llm", text: "Cached earlier." },
      ],
    });
    expect(useGameStore.getState().annotations[0]).toEqual({ admin: "The king's pawn.", llm: "Cached earlier." });
  });

  describe("analysisProgress", () => {
    it("starts null", () => {
      expect(useGameStore.getState().analysisProgress).toBeNull();
    });

    it("setAnalysisProgress sets the progress", () => {
      useGameStore.getState().setAnalysisProgress({ done: 3, total: 10 });
      expect(useGameStore.getState().analysisProgress).toEqual({ done: 3, total: 10 });
    });

    it("loadGame clears progress from a prior game", () => {
      useGameStore.getState().setAnalysisProgress({ done: 3, total: 10 });
      useGameStore.getState().loadGame(parseGame("1. e4"));
      expect(useGameStore.getState().analysisProgress).toBeNull();
    });

    it("reset clears progress", () => {
      useGameStore.getState().setAnalysisProgress({ done: 3, total: 10 });
      useGameStore.getState().reset();
      expect(useGameStore.getState().analysisProgress).toBeNull();
    });
  });

  describe("preview", () => {
    const fens = ["fen0", "fen1", "fen2", "fen3"];

    beforeEach(() => {
      useGameStore.getState().loadGame(parseGame("1. e4 e5 2. Nf3"));
    });

    it("starts inactive", () => {
      expect(useGameStore.getState().preview).toBeNull();
    });

    it("startPreview begins at step 1 so the first preview move is immediately visible", () => {
      useGameStore.getState().startPreview(fens, "Better: Nf3 Nc6");
      const s = useGameStore.getState();
      expect(s.preview).toEqual({ fens, step: 1, label: "Better: Nf3 Nc6" });
      expect(currentFen(s)).toBe(fens[1]);
    });

    it("stepPreview moves and clamps to [0, fens.length - 1]", () => {
      useGameStore.getState().startPreview(fens, "label");
      useGameStore.getState().stepPreview(1);
      expect(useGameStore.getState().preview?.step).toBe(2);
      useGameStore.getState().stepPreview(10);
      expect(useGameStore.getState().preview?.step).toBe(3); // clamped high
      useGameStore.getState().stepPreview(-10);
      expect(useGameStore.getState().preview?.step).toBe(0); // clamped low
    });

    it("endPreview clears the preview", () => {
      useGameStore.getState().startPreview(fens, "label");
      useGameStore.getState().endPreview();
      expect(useGameStore.getState().preview).toBeNull();
    });

    it("currentFen returns the preview fen while active", () => {
      useGameStore.getState().startPreview(fens, "label");
      useGameStore.getState().stepPreview(1);
      expect(currentFen(useGameStore.getState())).toBe(fens[2]);
    });

    it("goTo clears an active preview", () => {
      useGameStore.getState().startPreview(fens, "label");
      useGameStore.getState().goTo(0);
      expect(useGameStore.getState().preview).toBeNull();
    });

    it("next clears an active preview", () => {
      useGameStore.getState().startPreview(fens, "label");
      useGameStore.getState().next();
      expect(useGameStore.getState().preview).toBeNull();
    });

    it("prev clears an active preview", () => {
      useGameStore.getState().startPreview(fens, "label");
      useGameStore.getState().prev();
      expect(useGameStore.getState().preview).toBeNull();
    });

    it("loadGame clears an active preview", () => {
      useGameStore.getState().startPreview(fens, "label");
      useGameStore.getState().loadGame(parseGame("1. d4"));
      expect(useGameStore.getState().preview).toBeNull();
    });

    it("reset clears an active preview", () => {
      useGameStore.getState().startPreview(fens, "label");
      useGameStore.getState().reset();
      expect(useGameStore.getState().preview).toBeNull();
    });
  });
});
