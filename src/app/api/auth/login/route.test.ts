/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const userRows: any[] = [];
vi.mock("@/db", () => ({
  db: { select: () => ({ from: () => ({ where: async () => userRows }) }) },
}));
const verifyPassword = vi.fn(async () => false);
vi.mock("@/lib/auth/password", () => ({ verifyPassword: (...a: any[]) => verifyPassword(...a) }));
vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE: "chess_session",
  createSession: async () => "tok123",
}));

import { POST } from "@/app/api/auth/login/route";
import { _reset } from "@/lib/rateLimit";

function req(body: unknown, ip = "1.2.3.4") {
  return new Request("http://x/api/auth/login", {
    method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": ip },
  });
}

describe("login", () => {
  beforeEach(() => {
    userRows.length = 0;
    verifyPassword.mockReset(); verifyPassword.mockResolvedValue(false);
    _reset();
  });

  it("rejects missing fields", async () => {
    expect((await POST(req({ email: "a@b.co" }))).status).toBe(400);
  });

  it("401s with no user, but still runs a password verify against the dummy hash (timing oracle)", async () => {
    const res = await POST(req({ email: "nobody@b.co", password: "whatever" }));
    expect(res.status).toBe(401);
    expect(verifyPassword).toHaveBeenCalledTimes(1);
    expect(verifyPassword.mock.calls[0][1]).toBe("whatever");
  });

  it("401s on wrong password for an existing user", async () => {
    userRows.push({ id: "u1", email: "a@b.co", passwordHash: "h" });
    const res = await POST(req({ email: "a@b.co", password: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("logs in and sets the session cookie on a correct password", async () => {
    userRows.push({ id: "u1", email: "a@b.co", passwordHash: "h" });
    verifyPassword.mockResolvedValue(true);
    const res = await POST(req({ email: "a@b.co", password: "right" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("chess_session=tok123");
  });

  it("429s after the per-IP rate limit is exceeded", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await POST(req({ email: "a@b.co", password: "x" }, "9.9.9.9"));
      expect(res.status).toBe(401);
    }
    const res = await POST(req({ email: "a@b.co", password: "x" }, "9.9.9.9"));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "Too many requests — try again later" });
  });

  it("rate limits are independent per IP", async () => {
    for (let i = 0; i < 10; i++) await POST(req({ email: "a@b.co", password: "x" }, "9.9.9.9"));
    const res = await POST(req({ email: "a@b.co", password: "x" }, "8.8.8.8"));
    expect(res.status).toBe(401);
  });
});
