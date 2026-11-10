import { describe, it, expect } from "vitest";
import { hashToken } from "@/lib/token-hash";

describe("hashToken", () => {
  it("returns the SHA-256 hex digest", () => {
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("is deterministic and differs per input", () => {
    expect(hashToken("a")).toBe(hashToken("a"));
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });
});
