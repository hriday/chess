/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdmin = vi.fn();
vi.mock("@/lib/auth/guards", async (orig) => {
  const real = await orig() as any;
  return { ...real, requireAdmin: () => requireAdmin() };
});
vi.mock("@/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: async () => [], orderBy: async () => [] }) }),
    insert: () => ({ values: (v: any) => ({
      returning: async () => [{ id: "g1", ...v }],
      onConflictDoUpdate: async () => undefined,
    }) }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    delete: () => ({ where: async () => undefined }),
  },
}));

import { POST as createFamous } from "@/app/api/admin/games/route";
import { GET as listUsers } from "@/app/api/admin/users/route";
import { DELETE as deleteAnnotation } from "@/app/api/admin/annotations/route";
import { AuthError } from "@/lib/auth/guards";

const deleteReq = (body: unknown) =>
  new Request("http://x", { method: "DELETE", body: JSON.stringify(body) });

describe("admin gating", () => {
  beforeEach(() => { requireAdmin.mockReset(); });
  it("403s non-admins on every admin route", async () => {
    requireAdmin.mockRejectedValue(new AuthError(403));
    const res = await createFamous(new Request("http://x", { method: "POST", body: JSON.stringify({ pgn: "1. e4" }) }));
    expect(res.status).toBe(403);
    expect((await listUsers()).status).toBe(403);
    const delRes = await deleteAnnotation(deleteReq({ gameId: "g1", ply: 0, source: "llm" }));
    expect(delRes.status).toBe(403);
  });
  it("creates a famous game with null owner", async () => {
    requireAdmin.mockResolvedValue({ id: "a1", role: "admin" });
    const res = await createFamous(new Request("http://x", { method: "POST",
      body: JSON.stringify({ pgn: "1. e4 e5", title: "Test", description: "d" }) }));
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/admin/annotations", () => {
  beforeEach(() => { requireAdmin.mockReset(); });
  it("deletes a cached llm annotation for an admin", async () => {
    requireAdmin.mockResolvedValue({ id: "a1", role: "admin" });
    const res = await deleteAnnotation(deleteReq({ gameId: "g1", ply: 3, source: "llm" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
  it("400s for an invalid ply", async () => {
    requireAdmin.mockResolvedValue({ id: "a1", role: "admin" });
    const res = await deleteAnnotation(deleteReq({ gameId: "g1", ply: -1, source: "llm" }));
    expect(res.status).toBe(400);
  });
  it("400s for an invalid source", async () => {
    requireAdmin.mockResolvedValue({ id: "a1", role: "admin" });
    const res = await deleteAnnotation(deleteReq({ gameId: "g1", ply: 0, source: "nope" }));
    expect(res.status).toBe(400);
  });
});
