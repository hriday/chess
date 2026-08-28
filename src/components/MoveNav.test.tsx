// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";

const next = vi.fn();
const prev = vi.fn();
const goTo = vi.fn();
const stepPreview = vi.fn();

const storeState: any = {
  game: { moves: [{ san: "e4" }, { san: "e5" }] },
  next, prev, goTo, stepPreview, preview: null,
};
vi.mock("@/store/gameStore", () => ({
  useGameStore: () => storeState,
}));

import { MoveNav } from "@/components/MoveNav";

describe("MoveNav", () => {
  beforeEach(() => {
    next.mockClear(); prev.mockClear(); goTo.mockClear(); stepPreview.mockClear();
    storeState.preview = null;
  });
  afterEach(cleanup);

  it("routes ◀/▶ to next/prev when no preview is active", () => {
    render(<MoveNav />);
    fireEvent.click(screen.getByRole("button", { name: "previous" }));
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(prev).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
    expect(stepPreview).not.toHaveBeenCalled();
  });

  it("routes ◀/▶ to stepPreview(-1)/stepPreview(1) while previewing", () => {
    storeState.preview = { fens: ["a", "b", "c"], step: 1, label: "Better: Nf3" };
    render(<MoveNav />);
    fireEvent.click(screen.getByRole("button", { name: "previous" }));
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(stepPreview).toHaveBeenCalledWith(-1);
    expect(stepPreview).toHaveBeenCalledWith(1);
    expect(prev).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("⏮/⏭ still call goTo (leaving the preview) regardless of preview state", () => {
    storeState.preview = { fens: ["a", "b", "c"], step: 1, label: "Better: Nf3" };
    render(<MoveNav />);
    fireEvent.click(screen.getByRole("button", { name: "first" }));
    fireEvent.click(screen.getByRole("button", { name: "last" }));
    expect(goTo).toHaveBeenCalledWith(-1);
    expect(goTo).toHaveBeenCalledWith(1); // game.moves.length - 1
  });
});
