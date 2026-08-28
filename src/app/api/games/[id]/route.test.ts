/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { annotations } from "@/db/schema";

const getRequestUser = vi.fn();
const requireUser = vi.fn();
vi.mock("@/lib/auth/guards", async (orig) => {
  const real = await orig() as any;
  return { ...real, getRequestUser: () => getRequestUser(), requireUser: () => requireUser() };
});

const gameRows: any[] = [];
const annotationRows: any[] = [];
const deleted: any[] = [];
vi.mock("@/db", () => ({
  db: {
    select: (_cols?: any) => ({
      from: (table: any) => ({
        where: (..._a: any[]) => {
          const rows = table === annotations ? annotationRows : gameRows;
          return { orderBy: async () => rows, then: (r: any) => r(rows) };
        },
      }),
    }),
    delete: () => ({ where: async (..._a: any[]) => { deleted.push(_a); } }),
  },
}));

import { GET, DELETE } from "@/app/api/games/[id]/route";
import { AuthError } from "@/lib/auth/guards";

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/games/[id]", () => {
  beforeEach(() => {
    gameRows.length = 0; annotationRows.length = 0; deleted.length = 0;
    getRequestUser.mockReset(); requireUser.mockReset();
  });

  it("returns a private game to its owner", async () => {
    getRequestUser.mockResolvedValue({ id: "u1", isPaid: false, role: "user" });
    gameRows.push({ id: "g1", ownerId: "u1", isFamous: false });
    const res = await GET(new Request("http://x"), params("g1"));
    expect(res.status).toBe(200);
    expect((await res.json()).game.id).toBe("g1");
  });

  it("404s for another user viewing a private game", async () => {
    getRequestUser.mockResolvedValue({ id: "u2", isPaid: false, role: "user" });
    gameRows.push({ id: "g1", ownerId: "u1", isFamous: false });
    const res = await GET(new Request("http://x"), params("g1"));
    expect(res.status).toBe(404);
  });

  it("404s for an anonymous viewer of a private game", async () => {
    getRequestUser.mockResolvedValue(null);
    gameRows.push({ id: "g1", ownerId: "u1", isFamous: false });
    const res = await GET(new Request("http://x"), params("g1"));
    expect(res.status).toBe(404);
  });

  it("allows an anonymous viewer to see a famous game", async () => {
    getRequestUser.mockResolvedValue(null);
    gameRows.push({ id: "g1", ownerId: "someone-else", isFamous: true });
    const res = await GET(new Request("http://x"), params("g1"));
    expect(res.status).toBe(200);
  });

  it("404s for a missing game", async () => {
    getRequestUser.mockResolvedValue({ id: "u1", isPaid: false, role: "user" });
    const res = await GET(new Request("http://x"), params("missing"));
    expect(res.status).toBe(404);
  });

  it("filters llm annotations for an anonymous viewer", async () => {
    getRequestUser.mockResolvedValue(null);
    gameRows.push({ id: "g1", ownerId: "someone-else", isFamous: true });
    annotationRows.push(
      { ply: 0, source: "admin", text: "The king's pawn." },
      { ply: 1, source: "llm", text: "Paywalled commentary." },
    );
    const res = await GET(new Request("http://x"), params("g1"));
    const { annotations: notes } = await res.json();
    expect(notes).toEqual([{ ply: 0, source: "admin", text: "The king's pawn." }]);
  });

  it("filters llm annotations for a free (non-paid) owner", async () => {
    getRequestUser.mockResolvedValue({ id: "u1", isPaid: false, role: "user" });
    gameRows.push({ id: "g1", ownerId: "u1", isFamous: false });
    annotationRows.push(
      { ply: 0, source: "admin", text: "The king's pawn." },
      { ply: 1, source: "llm", text: "Paywalled commentary." },
    );
    const res = await GET(new Request("http://x"), params("g1"));
    const { annotations: notes } = await res.json();
    expect(notes).toEqual([{ ply: 0, source: "admin", text: "The king's pawn." }]);
  });

  it("includes llm annotations for a paid owner", async () => {
    getRequestUser.mockResolvedValue({ id: "u1", isPaid: true, role: "user" });
    gameRows.push({ id: "g1", ownerId: "u1", isFamous: false });
    annotationRows.push(
      { ply: 0, source: "admin", text: "The king's pawn." },
      { ply: 1, source: "llm", text: "Because it opens lines." },
    );
    const res = await GET(new Request("http://x"), params("g1"));
    const { annotations: notes } = await res.json();
    expect(notes).toHaveLength(2);
  });

  it("includes llm annotations for an admin viewer", async () => {
    getRequestUser.mockResolvedValue({ id: "u2", isPaid: false, role: "admin" });
    gameRows.push({ id: "g1", ownerId: "someone-else", isFamous: true });
    annotationRows.push({ ply: 0, source: "llm", text: "Because it opens lines." });
    const res = await GET(new Request("http://x"), params("g1"));
    const { annotations: notes } = await res.json();
    expect(notes).toHaveLength(1);
  });
});

describe("DELETE /api/games/[id]", () => {
  beforeEach(() => {
    gameRows.length = 0; annotationRows.length = 0; deleted.length = 0;
    getRequestUser.mockReset(); requireUser.mockReset();
  });

  it("401s when logged out", async () => {
    requireUser.mockRejectedValue(new AuthError(401));
    const res = await DELETE(new Request("http://x"), params("g1"));
    expect(res.status).toBe(401);
    expect(deleted).toHaveLength(0);
  });

  it("404s for a non-owner", async () => {
    requireUser.mockResolvedValue({ id: "u2" });
    gameRows.push({ id: "g1", ownerId: "u1" });
    const res = await DELETE(new Request("http://x"), params("g1"));
    expect(res.status).toBe(404);
    expect(deleted).toHaveLength(0);
  });

  it("deletes the game for its owner", async () => {
    requireUser.mockResolvedValue({ id: "u1" });
    gameRows.push({ id: "g1", ownerId: "u1" });
    const res = await DELETE(new Request("http://x"), params("g1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(deleted).toHaveLength(1);
  });
});
