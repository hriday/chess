/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const requireUser = vi.fn();
vi.mock("@/lib/auth/guards", async (orig) => {
  const real = await orig() as any;
  return { ...real, requireUser: () => requireUser() };
});
const rows: any[] = [];
vi.mock("@/db", () => ({
  db: {
    select: (cols?: any) => ({ from: () => ({ where: (..._a: any[]) => ({
      orderBy: async () => rows, then: (r: any) => r(rows) }) }) }),
    insert: () => ({ values: (v: any) => ({ returning: async () => [{ id: "g1", ...v }] }) }),
  },
}));

import { POST, GET } from "@/app/api/games/route";
import { AuthError } from "@/lib/auth/guards";

describe("games routes", () => {
  beforeEach(() => { rows.length = 0; requireUser.mockReset(); });

  it("401s when logged out", async () => {
    requireUser.mockRejectedValue(new AuthError(401));
    expect((await GET()).status).toBe(401);
  });

  it("rejects invalid PGN with 400", async () => {
    requireUser.mockResolvedValue({ id: "u1" });
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ pgn: "not chess at all" }) }));
    expect(res.status).toBe(400);
  });

  it("saves a valid game with derived meta", async () => {
    requireUser.mockResolvedValue({ id: "u1" });
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ pgn: "1. e4 e5" }) }));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe("g1");
  });
});
