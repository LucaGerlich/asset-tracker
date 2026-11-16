import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn().mockResolvedValue({
    organization: { id: "org-uuid-001", name: "Test Org" },
  }),
}));
vi.mock("@/lib/encryption", () => ({
  encrypt: (value: string) => `enc:${value}`,
  decrypt: (value: string) => value,
}));

const s3 = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/storage/s3", () => ({
  S3StorageProvider: vi.fn(function () {
    return { upload: s3.upload, delete: s3.remove };
  }),
}));

const lookup = vi.hoisted(() => vi.fn());
vi.mock("dns/promises", () => ({ default: { lookup } }));

import { PUT as saveStorage } from "@/app/api/admin/settings/storage/route";
import { POST as testStorage } from "@/app/api/admin/settings/storage/test/route";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, true);

const payload = (endpoint: string) => ({
  endpoint,
  bucket: "assets",
  accessKey: "AK",
  secretKey: "SK",
});

const put = (endpoint: string) =>
  saveStorage(
    createMockRequest("/api/admin/settings/storage", {
      method: "PUT",
      body: payload(endpoint),
    }),
  );

const test = (endpoint: string) =>
  testStorage(
    createMockRequest("/api/admin/settings/storage/test", {
      method: "POST",
      body: payload(endpoint),
    }),
  );

const BAD_ENDPOINTS = [
  "http://s3.example.test",
  "https://127.0.0.1",
  "https://169.254.169.254/latest/meta-data",
  "https://[::ffff:7f00:1]",
  "https://localhost:9000",
];

beforeEach(() => {
  vi.clearAllMocks();
  lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  mockPrisma.organizationStorageConfig.findUnique.mockResolvedValue(null);
});

describe("PUT /api/admin/settings/storage endpoint validation", () => {
  it.each(BAD_ENDPOINTS)("rejects %s", async (endpoint) => {
    const { status } = await parseResponse(await put(endpoint));

    expect(status).toBe(400);
    expect(mockPrisma.organizationStorageConfig.create).not.toHaveBeenCalled();
  });

  it("rejects a hostname that resolves to a private address", async () => {
    lookup.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);

    const { status } = await parseResponse(await put("https://s3.evil.test"));

    expect(status).toBe(400);
    expect(mockPrisma.organizationStorageConfig.create).not.toHaveBeenCalled();
  });

  it("saves a public https endpoint", async () => {
    const { status } = await parseResponse(
      await put("https://s3.example.test"),
    );

    expect(status).toBe(200);
    expect(mockPrisma.organizationStorageConfig.create).toHaveBeenCalledTimes(
      1,
    );
  });
});

describe("POST /api/admin/settings/storage/test endpoint validation", () => {
  it.each(BAD_ENDPOINTS)("rejects %s without connecting", async (endpoint) => {
    const { status } = await parseResponse(await test(endpoint));

    expect(status).toBe(400);
    expect(s3.upload).not.toHaveBeenCalled();
  });

  it("tests a public https endpoint", async () => {
    s3.upload.mockResolvedValue(undefined);
    s3.remove.mockResolvedValue(undefined);

    const { body } = await parseResponse(await test("https://s3.example.test"));

    expect(body).toEqual({ success: true });
  });
});
