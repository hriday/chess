import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("s3cret!");
    expect(hash).not.toContain("s3cret!");
    expect(await verifyPassword(hash, "s3cret!")).toBe(true);
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });
});
