/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const insertedUsers: any[] = [];
let insertShouldThrowUniqueViolation = false;
vi.mock("@/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: async () => insertedUsers }) }),
    insert: () => ({ values: (v: any) => ({ returning: async () => {
      if (insertShouldThrowUniqueViolation) throw { code: "23505" };
      const row = { id: "u1", ...v };
      insertedUsers.push(row);
      return [row];
    } }) }),
  },
}));
vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE: "chess_session",
  createSession: async () => "tok123",
}));

import { POST } from "@/app/api/auth/signup/route";
import { _reset } from "@/lib/rateLimit";

function req(body: unknown, ip = "1.2.3.4") {
  return new Request("http://x/api/auth/signup", {
    method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": ip },
  });
}

describe("signup", () => {
  beforeEach(() => { insertedUsers.length = 0; insertShouldThrowUniqueViolation = false; _reset(); });
  it("rejects invalid email", async () => {
    expect((await POST(req({ email: "nope", password: "longenough" }))).status).toBe(400);
  });
  it("rejects short password", async () => {
    expect((await POST(req({ email: "a@b.co", password: "short" }))).status).toBe(400);
  });
  it("creates user and sets session cookie", async () => {
    const res = await POST(req({ email: "a@b.co", password: "longenough" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("chess_session=tok123");
    expect(insertedUsers[0].email).toBe("a@b.co");
  });
  it("409s on duplicate email", async () => {
    await POST(req({ email: "a@b.co", password: "longenough" }));
    expect((await POST(req({ email: "a@b.co", password: "longenough" }))).status).toBe(409);
  });
  it("409s when a concurrent insert hits the unique constraint", async () => {
    insertShouldThrowUniqueViolation = true;
    const res = await POST(req({ email: "race@b.co", password: "longenough" }));
    expect(res.status).toBe(409);
  });
  it("429s after the per-IP rate limit is exceeded", async () => {
    // The db mock returns a shared "existing users" array regardless of email, so only
    // the first call here actually succeeds (200) and the rest 409 — that's fine, the
    // point is that all 10 count against the limiter before any DB work's result matters.
    for (let i = 0; i < 10; i++) {
      const res = await POST(req({ email: `u${i}@b.co`, password: "longenough" }, "9.9.9.9"));
      expect(res.status).not.toBe(429);
    }
    const res = await POST(req({ email: "over@b.co", password: "longenough" }, "9.9.9.9"));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "Too many requests — try again later" });
  });
});
