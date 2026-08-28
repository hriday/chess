/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { annotations } from "@/db/schema";

const requirePaid = vi.fn();
vi.mock("@/lib/auth/guards", async (orig) => {
  const real = await orig() as any;
  return { ...real, requirePaid: () => requirePaid() };
});
const gameRows: any[] = [];
const cachedRows: any[] = [];
const inserted: any[] = [];
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: (table: any) => ({
        where: async () => (table === annotations ? cachedRows : gameRows),
      }),
    }),
    insert: () => ({
      values: (v: any) => {
        inserted.push(v);
        return { onConflictDoNothing: async () => { /* noop */ } };
      },
    }),
  },
}));
const explainMove = vi.fn(async () => "Because the bishop eyes f7.");
vi.mock("@/lib/llm/explain", async (orig) => ({
  ...(await orig()) as any, explainMove: (i: any) => explainMove(i),
}));

import { POST } from "@/app/api/explain/route";
import { AuthError } from "@/lib/auth/guards";
import { _reset } from "@/lib/rateLimit";

const body = {
  fen: "x", san: "Bc4", moveNumber: 3, color: "w",
  evalBefore: 30, evalAfter: 25, bestMoveSan: "Bb5", bestLine: ["Bb5"], title: "t",
  movesSoFar: ["e4", "e5", "Nf3", "Nc6", "Bc4"], verdict: "good",
};
const req = (b: unknown, ip = "1.2.3.4") =>
  new Request("http://x/api/explain", {
    method: "POST", body: JSON.stringify(b), headers: { "x-forwarded-for": ip },
  });

describe("POST /api/explain", () => {
  beforeEach(() => {
    gameRows.length = 0; cachedRows.length = 0; inserted.length = 0;
    explainMove.mockClear(); requirePaid.mockReset(); _reset();
  });

  it("402s for unpaid users without calling the LLM", async () => {
    requirePaid.mockRejectedValue(new AuthError(402));
    const res = await POST(req(body));
    expect(res.status).toBe(402);
    expect(explainMove).not.toHaveBeenCalled();
  });

  it("calls the LLM and returns text", async () => {
    requirePaid.mockResolvedValue({ id: "u1" });
    const res = await POST(req(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "Because the bishop eyes f7.", cached: false });
    expect(inserted).toHaveLength(0); // no gameId -> nothing cached
  });

  it("returns the cache and skips the LLM when annotated", async () => {
    requirePaid.mockResolvedValue({ id: "u1" });
    gameRows.push({ id: "g1", ownerId: "u1", isFamous: false });
    cachedRows.push({ text: "cached!", source: "llm" });
    const res = await POST(req({ ...body, gameId: "g1", ply: 4 }));
    expect(await res.json()).toEqual({ text: "cached!", cached: true });
    expect(explainMove).not.toHaveBeenCalled();
  });

  it("writes through to the cache when gameId present", async () => {
    requirePaid.mockResolvedValue({ id: "u1" });
    gameRows.push({ id: "g1", ownerId: "u1", isFamous: false });
    await POST(req({ ...body, gameId: "g1", ply: 4 }));
    expect(inserted[0]).toMatchObject({ gameId: "g1", ply: 4, source: "llm" });
  });

  it("404s and skips the LLM for an unknown gameId", async () => {
    requirePaid.mockResolvedValue({ id: "u1" });
    const res = await POST(req({ ...body, gameId: "missing", ply: 0 }));
    expect(res.status).toBe(404);
    expect(explainMove).not.toHaveBeenCalled();
  });

  it("404s for a paid non-owner on someone else's private game", async () => {
    requirePaid.mockResolvedValue({ id: "u1" });
    gameRows.push({ id: "g1", ownerId: "owner2", isFamous: false });
    const res = await POST(req({ ...body, gameId: "g1", ply: 0 }));
    expect(res.status).toBe(404);
    expect(explainMove).not.toHaveBeenCalled();
  });

  it("allows a paid non-owner to explain a famous game", async () => {
    requirePaid.mockResolvedValue({ id: "u1" });
    gameRows.push({ id: "g1", ownerId: "owner2", isFamous: true });
    const res = await POST(req({ ...body, gameId: "g1", ply: 0 }));
    expect(res.status).toBe(200);
    expect(explainMove).toHaveBeenCalled();
  });

  it("400s for a negative ply", async () => {
    requirePaid.mockResolvedValue({ id: "u1" });
    const res = await POST(req({ ...body, gameId: "g1", ply: -1 }));
    expect(res.status).toBe(400);
    expect(explainMove).not.toHaveBeenCalled();
  });

  it("400s for a non-integer ply", async () => {
    requirePaid.mockResolvedValue({ id: "u1" });
    const res = await POST(req({ ...body, gameId: "g1", ply: 1.5 }));
    expect(res.status).toBe(400);
    expect(explainMove).not.toHaveBeenCalled();
  });

  it("400s when bestLine is missing", async () => {
    requirePaid.mockResolvedValue({ id: "u1" });
    const rest: Record<string, unknown> = { ...body };
    delete rest.bestLine;
    const res = await POST(req(rest));
    expect(res.status).toBe(400);
    expect(explainMove).not.toHaveBeenCalled();
  });

  it("400s when movesSoFar is missing", async () => {
    requirePaid.mockResolvedValue({ id: "u1" });
    const rest: Record<string, unknown> = { ...body };
    delete rest.movesSoFar;
    const res = await POST(req(rest));
    expect(res.status).toBe(400);
    expect(explainMove).not.toHaveBeenCalled();
  });

  it("400s when verdict is missing", async () => {
    requirePaid.mockResolvedValue({ id: "u1" });
    const rest: Record<string, unknown> = { ...body };
    delete rest.verdict;
    const res = await POST(req(rest));
    expect(res.status).toBe(400);
    expect(explainMove).not.toHaveBeenCalled();
  });

  it("accepts an empty movesSoFar array", async () => {
    requirePaid.mockResolvedValue({ id: "u1" });
    const res = await POST(req({ ...body, movesSoFar: [] }));
    expect(res.status).toBe(200);
    expect(explainMove).toHaveBeenCalled();
  });

  it("429s after the per-IP rate limit is exceeded, without calling the LLM", async () => {
    requirePaid.mockResolvedValue({ id: "u1" });
    for (let i = 0; i < 30; i++) {
      const res = await POST(req(body, "9.9.9.9"));
      expect(res.status).toBe(200);
    }
    explainMove.mockClear();
    const res = await POST(req(body, "9.9.9.9"));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "Too many requests — try again later" });
    expect(explainMove).not.toHaveBeenCalled();
  });
});
