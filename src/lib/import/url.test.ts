import { describe, it, expect, vi } from "vitest";
import { classifyGameUrl, fetchPgnFromUrl, ImportError } from "@/lib/import/url";

describe("classifyGameUrl", () => {
  it("recognizes lichess URLs", () => {
    expect(classifyGameUrl("https://lichess.org/AbCd1234")).toEqual({ site: "lichess", gameId: "AbCd1234" });
    expect(classifyGameUrl("https://lichess.org/AbCd1234/black#12")).toEqual({ site: "lichess", gameId: "AbCd1234" });
  });
  it("recognizes chess.com live URLs", () => {
    expect(classifyGameUrl("https://www.chess.com/game/live/1234567890")).toMatchObject({ site: "chesscom" });
  });
  it("returns null for anything else", () => {
    expect(classifyGameUrl("https://example.com/x")).toBeNull();
  });
  it("rejects lookalike domains like evilchess.com", () => {
    expect(classifyGameUrl("https://evilchess.com/game/live/123")).toBeNull();
  });
});

describe("fetchPgnFromUrl", () => {
  it("fetches lichess PGN export", async () => {
    const fetchFn = vi.fn(async () => new Response('[Event "x"]\n\n1. e4 *', { status: 200 }));
    const pgn = await fetchPgnFromUrl("https://lichess.org/AbCd1234", fetchFn as unknown as typeof fetch);
    expect(pgn).toContain("1. e4");
    expect(fetchFn).toHaveBeenCalledWith(
      "https://lichess.org/game/export/AbCd1234",
      { headers: { Accept: "application/x-chess-pgn" } });
  });
  it("throws ImportError on 404", async () => {
    const fetchFn = vi.fn(async () => new Response("", { status: 404 }));
    await expect(fetchPgnFromUrl("https://lichess.org/AbCd1234", fetchFn as unknown as typeof fetch)).rejects.toThrow(ImportError);
  });
  it("throws a friendly error for chess.com", async () => {
    await expect(fetchPgnFromUrl("https://www.chess.com/game/live/123")).rejects.toThrow(/paste the PGN/);
  });
  it("throws for unknown URLs", async () => {
    await expect(fetchPgnFromUrl("https://example.com")).rejects.toThrow(ImportError);
  });
});
