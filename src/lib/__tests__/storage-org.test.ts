import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/encryption", () => ({
  decrypt: (value: string) => `dec:${value}`,
}));

const s3 = vi.hoisted(() => ({ ctor: vi.fn() }));
vi.mock("@/lib/storage/s3", () => ({
  S3StorageProvider: vi.fn(function (config?: unknown) {
    s3.ctor(config);
    return { kind: config ? "org-s3" : "global-s3" };
  }),
}));

const lookup = vi.hoisted(() => vi.fn());
vi.mock("dns/promises", () => ({ default: { lookup } }));

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  getOrgStorage,
  resetOrgStorageValidationCache,
  ORG_STORAGE_VALIDATION_TTL_MS,
} from "@/lib/storage";

const mockPrisma = vi.mocked(prisma, true);

const ORG_ID = "11111111-1111-4111-8111-111111111111";

const storedConfig = (endpoint: string) =>
  ({
    bucket: "assets",
    region: "auto",
    endpoint,
    accessKey: "AK",
    secretKey: "SK",
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  resetOrgStorageValidationCache();
  lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
});

describe("getOrgStorage endpoint validation", () => {
  it("builds the org S3 client for a public https endpoint", async () => {
    mockPrisma.organizationStorageConfig.findUnique.mockResolvedValue(
      storedConfig("https://s3.example.test"),
    );

    const storage = await getOrgStorage(ORG_ID);

    expect(storage).toEqual({ kind: "org-s3" });
    expect(s3.ctor).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "https://s3.example.test",
        accessKey: "dec:AK",
      }),
    );
  });

  it.each([
    "http://s3.example.test",
    "https://169.254.169.254",
    "https://127.0.0.1:9000",
    "https://[::ffff:7f00:1]",
  ])(
    "fails closed for the stored endpoint %s instead of using the shared bucket",
    async (endpoint) => {
      mockPrisma.organizationStorageConfig.findUnique.mockResolvedValue(
        storedConfig(endpoint),
      );

      // Falling back to the default provider would put this org's files in
      // the platform bucket and hide its existing ones.
      await expect(getOrgStorage(ORG_ID)).rejects.toThrow(
        "Organization storage endpoint failed validation",
      );
      expect(s3.ctor).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        "Org storage endpoint rejected by SSRF validation",
        expect.objectContaining({ organizationId: ORG_ID }),
      );
    },
  );

  it("accepts an internal http endpoint on a self-hosted install", async () => {
    vi.stubEnv("SELF_HOSTED", "true");
    mockPrisma.organizationStorageConfig.findUnique.mockResolvedValue(
      storedConfig("http://minio:9000"),
    );

    const storage = await getOrgStorage(ORG_ID);

    expect(storage).toEqual({ kind: "org-s3" });
    vi.unstubAllEnvs();
  });

  it("rejects a stored hostname that now resolves to a private address", async () => {
    lookup.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);
    mockPrisma.organizationStorageConfig.findUnique.mockResolvedValue(
      storedConfig("https://s3.example.test"),
    );

    await expect(getOrgStorage(ORG_ID)).rejects.toThrow();
    expect(s3.ctor).not.toHaveBeenCalled();
  });
});

describe("getOrgStorage validation cache", () => {
  const configure = (endpoint: string) =>
    mockPrisma.organizationStorageConfig.findUnique.mockResolvedValue(
      storedConfig(endpoint),
    );

  it("does not repeat the DNS lookup within the TTL", async () => {
    configure("https://s3.example.test");

    await getOrgStorage(ORG_ID);
    await getOrgStorage(ORG_ID);

    expect(lookup).toHaveBeenCalledTimes(1);
    // The client is still built per call, from the freshly loaded config.
    expect(s3.ctor).toHaveBeenCalledTimes(2);
  });

  it("validates again once the TTL has passed", async () => {
    vi.useFakeTimers();
    configure("https://s3.example.test");

    await getOrgStorage(ORG_ID);
    vi.advanceTimersByTime(ORG_STORAGE_VALIDATION_TTL_MS - 1);
    await getOrgStorage(ORG_ID);
    expect(lookup).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2);
    await getOrgStorage(ORG_ID);
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("validates a changed endpoint even inside the TTL", async () => {
    configure("https://s3.example.test");
    await getOrgStorage(ORG_ID);

    configure("https://other.example.test");
    await getOrgStorage(ORG_ID);

    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("caches per organization", async () => {
    configure("https://s3.example.test");
    await getOrgStorage(ORG_ID);
    await getOrgStorage("22222222-2222-4222-8222-222222222222");

    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("never caches a failed validation", async () => {
    lookup.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);
    configure("https://s3.example.test");
    await expect(getOrgStorage(ORG_ID)).rejects.toThrow();

    lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    await expect(getOrgStorage(ORG_ID)).resolves.toEqual({ kind: "org-s3" });
    expect(lookup).toHaveBeenCalledTimes(2);
  });
});
