import { describe, it, expect } from "vitest";
import { requestIp } from "@/lib/requestIp";

function req(headers: Record<string, string> = {}) {
  return new Request("http://x", { headers });
}

describe("requestIp", () => {
  it("uses the single hop when there's only one", () => {
    expect(requestIp(req({ "x-forwarded-for": "1.2.3.4" }))).toBe("1.2.3.4");
  });

  it("uses the LAST hop, not the first, for a multi-hop chain", () => {
    // The last hop is the one Caddy itself appended; earlier hops (including a
    // spoofed first entry) are attacker-controlled and must not be trusted.
    expect(requestIp(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("5.6.7.8");
  });

  it("trims whitespace around the last hop", () => {
    expect(requestIp(req({ "x-forwarded-for": "1.2.3.4,   5.6.7.8   " }))).toBe("5.6.7.8");
  });

  it("falls back to \"local\" when the header is absent", () => {
    expect(requestIp(req())).toBe("local");
  });

  it("falls back to \"local\" when the header is present but empty", () => {
    expect(requestIp(req({ "x-forwarded-for": "" }))).toBe("local");
  });

  it("falls back to \"local\" when the last hop is empty after trimming", () => {
    expect(requestIp(req({ "x-forwarded-for": "1.2.3.4, " }))).toBe("local");
  });
});
