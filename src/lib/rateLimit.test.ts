import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, _reset } from "@/lib/rateLimit";

describe("rateLimit", () => {
  beforeEach(() => _reset());

  it("allows up to the limit", () => {
    for (let i = 0; i < 5; i++) expect(rateLimit("b", "k", 5, 1000)).toBe(true);
  });

  it("blocks once the limit is exceeded", () => {
    for (let i = 0; i < 5; i++) rateLimit("b", "k", 5, 1000);
    expect(rateLimit("b", "k", 5, 1000)).toBe(false);
  });

  it("resets after the window elapses", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) rateLimit("b", "k", 3, 1000, now);
    expect(rateLimit("b", "k", 3, 1000, now + 500)).toBe(false);
    expect(rateLimit("b", "k", 3, 1000, now + 1001)).toBe(true);
  });

  it("keeps buckets independent", () => {
    for (let i = 0; i < 3; i++) rateLimit("bucket-a", "k", 3, 1000);
    expect(rateLimit("bucket-a", "k", 3, 1000)).toBe(false);
    expect(rateLimit("bucket-b", "k", 3, 1000)).toBe(true);
  });

  it("keeps keys independent within a bucket", () => {
    for (let i = 0; i < 3; i++) rateLimit("b", "key-a", 3, 1000);
    expect(rateLimit("b", "key-a", 3, 1000)).toBe(false);
    expect(rateLimit("b", "key-b", 3, 1000)).toBe(true);
  });

  it("accepts an injectable now for deterministic tests", () => {
    const now = 500;
    expect(rateLimit("b", "k", 1, 1000, now)).toBe(true);
    expect(rateLimit("b", "k", 1, 1000, now + 1)).toBe(false);
  });
});
