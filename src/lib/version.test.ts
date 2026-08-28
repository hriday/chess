import { describe, it, expect } from "vitest";
import { APP_NAME } from "@/lib/version";

describe("scaffold", () => {
  it("resolves the @ alias and runs tests", () => {
    expect(APP_NAME).toBe("chess.moosha.org");
  });
});
