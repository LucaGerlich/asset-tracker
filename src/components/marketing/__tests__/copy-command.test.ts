import { describe, it, expect, vi } from "vitest";
import { copyText } from "../primitives/copy-command";

describe("copyText", () => {
  it("returns 'unsupported' when the Clipboard API is missing (http:// LAN)", async () => {
    await expect(copyText("docker compose up -d", undefined)).resolves.toBe(
      "unsupported",
    );
  });

  it("returns 'copied' when writeText resolves", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(copyText("x", { writeText })).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith("x");
  });

  it("returns 'failed' when permission is denied", async () => {
    const writeText = vi
      .fn()
      .mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    await expect(copyText("x", { writeText })).resolves.toBe("failed");
  });
});
