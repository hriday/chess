import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "tok" }) }),
}));
const getSessionUser = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  SESSION_COOKIE: "chess_session",
  getSessionUser: (t: string) => getSessionUser(t),
}));

import { requireUser, requirePaid, requireAdmin, AuthError } from "@/lib/auth/guards";

const base = { id: "u1", email: "a@b.c", passwordHash: "", role: "user", isPaid: false, createdAt: new Date() };

describe("guards", () => {
  beforeEach(() => getSessionUser.mockReset());
  it("requireUser throws 401 when logged out", async () => {
    getSessionUser.mockResolvedValue(null);
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });
  it("requireUser returns the user", async () => {
    getSessionUser.mockResolvedValue(base);
    expect((await requireUser()).id).toBe("u1");
  });
  it("requirePaid throws 402 for free users, passes paid and admin", async () => {
    getSessionUser.mockResolvedValue(base);
    await expect(requirePaid()).rejects.toMatchObject({ status: 402 });
    getSessionUser.mockResolvedValue({ ...base, isPaid: true });
    await expect(requirePaid()).resolves.toBeTruthy();
    getSessionUser.mockResolvedValue({ ...base, role: "admin" });
    await expect(requirePaid()).resolves.toBeTruthy();
  });
  it("requireAdmin throws 403 for non-admins", async () => {
    getSessionUser.mockResolvedValue({ ...base, isPaid: true });
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  });
  it("AuthError carries status", () => expect(new AuthError(401).status).toBe(401));
});
