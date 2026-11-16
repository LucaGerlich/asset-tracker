import { describe, it, expect, vi, beforeEach } from "vitest";

const sharpMock = vi.hoisted(() => {
  const pipeline = {
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("thumb")),
  };
  return { factory: vi.fn(() => pipeline), pipeline };
});
vi.mock("sharp", () => ({ default: sharpMock.factory }));

import { generateThumbnails } from "@/lib/storage/thumbnails";
import type { StorageProvider } from "@/lib/storage/types";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateThumbnails", () => {
  it("caps the decoded pixel count to guard against decompression bombs", async () => {
    const storage = {
      upload: vi.fn().mockResolvedValue(undefined),
    } as unknown as StorageProvider;
    const input = Buffer.from("image");

    await generateThumbnails(storage, "uuid-1", input);

    expect(sharpMock.factory).toHaveBeenCalled();
    for (const call of sharpMock.factory.mock.calls as unknown[][]) {
      expect(call[0]).toBe(input);
      expect(call[1]).toEqual({ limitInputPixels: 40_000_000 });
    }
  });
});
