import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(async (value: string) => `hash:${value}`),
    compare: vi.fn(
      async (value: string, hash: string) => hash === `hash:${value}`,
    ),
  },
}));

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { generateApiKey, validateApiKey } from "@/lib/api-keys";

const findMany = vi.mocked(prisma.apiKey.findMany);
const compare = vi.mocked(bcrypt.compare);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.apiKey.update).mockResolvedValue({} as never);
});

describe("generateApiKey", () => {
  it("stores the first 16 characters as the lookup prefix", async () => {
    const { key, prefix } = await generateApiKey();
    expect(key).toHaveLength(72);
    expect(prefix).toHaveLength(16);
    expect(prefix).toBe(key.substring(0, 16));
    expect(prefix.startsWith("at_live_")).toBe(true);
  });

  it("generates distinct lookup prefixes", async () => {
    const a = await generateApiKey();
    const b = await generateApiKey();
    expect(a.prefix).not.toBe(b.prefix);
  });
});

describe("validateApiKey", () => {
  it("looks a new-format key up by its 16-char prefix and does one bcrypt compare", async () => {
    const { key, prefix, hash } = await generateApiKey();
    compare.mockClear();
    findMany.mockResolvedValueOnce([
      { id: "k1", keyPrefix: prefix, keyHash: hash },
    ] as never);

    const result = await validateApiKey(key);

    expect(result).toMatchObject({ id: "k1" });
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0]?.where?.keyPrefix).toBe(prefix);
    expect(compare).toHaveBeenCalledTimes(1);
  });

  it("falls back to legacy 8-char rows when no new-format row matches", async () => {
    const { key, hash } = await generateApiKey();
    findMany
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([
        { id: "legacy", keyPrefix: "at_live_", keyHash: hash },
      ] as never);

    const result = await validateApiKey(key);

    expect(result).toMatchObject({ id: "legacy" });
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany.mock.calls[1][0]?.where?.keyPrefix).toBe("at_live_");
  });

  it("rejects a key with the wrong length without touching the database", async () => {
    expect(await validateApiKey("at_live_short")).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("rejects a key that is not an at_ key", async () => {
    expect(await validateApiKey("x".repeat(72))).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });
});
