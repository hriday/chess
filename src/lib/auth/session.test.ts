import { describe, it, expect } from "vitest";
import { generateSessionToken, sessionExpiry, SESSION_COOKIE, hashSessionToken } from "@/lib/auth/session";

describe("session", () => {
  it("generates unique 48-char hex tokens", () => {
    const a = generateSessionToken();
    expect(a).toMatch(/^[0-9a-f]{48}$/);
    expect(generateSessionToken()).not.toBe(a);
  });
  it("expires 30 days out", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(sessionExpiry(now).getTime() - now.getTime()).toBe(30 * 24 * 3600 * 1000);
  });
  it("names the cookie", () => expect(SESSION_COOKIE).toBe("chess_session"));
});

describe("hashSessionToken", () => {
  it("returns a 64-char hex digest", () => {
    expect(hashSessionToken(generateSessionToken())).toMatch(/^[0-9a-f]{64}$/);
  });
  it("is deterministic", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });
  it("differs from the input token", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).not.toBe(token);
  });
});
