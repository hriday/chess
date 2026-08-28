// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import React from "react";

const storeState: any = {
  game: null, gameId: null, currentPly: -1, evals: {}, meta: null, annotations: {},
};
vi.mock("@/store/gameStore", () => ({
  useGameStore: () => storeState,
}));

import { ExplainButton } from "@/components/ExplainButton";

const baseGame = {
  moves: [{ san: "e4", moveNumber: 1, color: "w" }, { san: "e5", moveNumber: 1, color: "b" }],
  positions: ["fen0", "fen1", "fen2"],
};

function setStore(overrides: Partial<typeof storeState>) {
  Object.assign(storeState, {
    game: baseGame, gameId: null, currentPly: 0,
    evals: { 0: { evalBefore: 20, evalAfter: 25, bestMoveSan: "Nf3", bestLine: ["Nf3"] } },
    meta: { title: "Test game" }, annotations: {},
  }, overrides);
}

describe("ExplainButton", () => {
  beforeEach(() => {
    setStore({});
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ text: "It develops a piece.", cached: false }),
    })));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("fetches and displays the explanation, caching it for the ply", async () => {
    const { rerender } = render(<ExplainButton />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText("It develops a piece.")).toBeTruthy());
    expect(fetch).toHaveBeenCalledTimes(1);
    const sent = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(sent.movesSoFar).toEqual(["e4"]);
    expect(sent.startPly).toBe(0);
    expect(sent.verdict).toBe("best");

    // Navigate away to another ply and back — cached text should reappear
    // without a new fetch, since the cache resets only when `game` changes.
    setStore({ currentPly: 1, evals: { ...storeState.evals, 1: storeState.evals[0] } });
    rerender(<ExplainButton />);
    expect(screen.getByRole("button")).toBeTruthy();

    setStore({ currentPly: 0 });
    rerender(<ExplainButton />);
    expect(screen.getByText("It develops a piece.")).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("clears the cache when the game changes", async () => {
    const { rerender } = render(<ExplainButton />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText("It develops a piece.")).toBeTruthy());

    setStore({ game: { ...baseGame }, currentPly: 0 }); // new game object identity
    rerender(<ExplainButton />);
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("caps movesSoFar at the last 60 and offsets startPly for long games", async () => {
    const longMoves = Array.from({ length: 90 }, (_, i) => ({
      san: `m${i}`, moveNumber: Math.floor(i / 2) + 1, color: i % 2 === 0 ? "w" : "b",
    }));
    setStore({
      game: { moves: longMoves, positions: [] },
      currentPly: 80,
      evals: { 80: { evalBefore: 20, evalAfter: 25, bestMoveSan: "Nf3", bestLine: ["Nf3"] } },
    });
    render(<ExplainButton />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const sent = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(sent.movesSoFar).toHaveLength(60);
    expect(sent.movesSoFar[0]).toBe("m21"); // ply 0..80 -> 81 moves, tail of 60 starts at ply 21
    expect(sent.startPly).toBe(21);
  });

  it("shows a login link on a 402 without caching an error as text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false, status: 402, json: async () => ({ error: "Paid account required" }),
    })));
    render(<ExplainButton />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText(/Paid account required/)).toBeTruthy());
    expect(screen.getByText("log in")).toBeTruthy();
  });

  it("hides itself when an llm annotation already exists for the ply", () => {
    setStore({ annotations: { 0: { llm: "Already explained." } } });
    const { container } = render(<ExplainButton />);
    expect(container.firstChild).toBeNull();
  });
});
