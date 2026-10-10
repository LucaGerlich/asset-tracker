import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
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
  scopeToOrganization: vi.fn((where: object) => ({
    ...where,
    organizationId: "org-uuid-001",
  })),
}));
vi.mock("@/lib/encryption", () => ({
  encrypt: (value: string) => `enc:${value}`,
  decrypt: (value: string) => value,
}));
vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/integrations/slack-teams", () => ({
  notifyIntegrations: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/cache", () => ({
  invalidateCacheByPrefix: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/integrations/intune", () => ({ syncIntuneDevices: vi.fn() }));
vi.mock("@/lib/freshdesk", () => ({ createFreshdeskClient: vi.fn() }));

const s3 = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/storage/s3", () => ({
  S3StorageProvider: vi.fn(function () {
    return { upload: s3.upload, delete: s3.remove };
  }),
}));

import { POST as syncIntune } from "@/app/api/admin/settings/intune/sync/route";
import { POST as testFreshdesk } from "@/app/api/admin/settings/freshdesk/test/route";
import { POST as testStorage } from "@/app/api/admin/settings/storage/test/route";
import { GET as getStorage } from "@/app/api/admin/settings/storage/route";
import { PUT as updateStatus } from "@/app/api/asset/updateStatus/route";
import { POST as assignAsset } from "@/app/api/userAssets/assign/route";
import { GET as getUsers } from "@/app/api/user/getUser/route";
import { GET as getReady } from "@/app/api/health/ready/route";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { syncIntuneDevices } from "@/lib/integrations/intune";
import { createFreshdeskClient } from "@/lib/freshdesk";

const mockPrisma = vi.mocked(prisma, true);

/** Text an unexpected error carries that must never reach a client. */
const INTERNAL =
  'connect ECONNREFUSED 10.0.0.5:5432 for user "asset_app" (secret-token-123)';

/** Assert the serialized response body shares nothing with the internal error. */
function expectNoInternals(body: unknown) {
  const text = JSON.stringify(body);
  for (const leak of [
    "ECONNREFUSED",
    "10.0.0.5",
    "asset_app",
    "secret-token-123",
    "invocation",
  ]) {
    expect(text).not.toContain(leak);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/settings/intune/sync", () => {
  it("answers an unexpected error with a fixed body and logs the details", async () => {
    const failure = new Error(INTERNAL);
    vi.mocked(syncIntuneDevices).mockRejectedValue(failure);

    const { status, body } = await parseResponse(await syncIntune());

    expect(status).toBe(500);
    expect(body).toEqual({ success: false, error: "Failed to sync" });
    expectNoInternals(body);
    expect(logger.error).toHaveBeenCalledWith(
      "POST /api/admin/settings/intune/sync error",
      { error: failure },
    );
  });
});

describe("POST /api/admin/settings/freshdesk/test", () => {
  const send = () =>
    testFreshdesk(
      createMockRequest("/api/admin/settings/freshdesk/test", {
        method: "POST",
        body: { domain: "acme", apiKey: "key-123" },
      }),
    );

  it("answers an unexpected error with a fixed body and logs the details", async () => {
    const failure = new Error(INTERNAL);
    vi.mocked(createFreshdeskClient).mockReturnValue({
      testConnection: vi.fn().mockRejectedValue(failure),
    } as never);

    const { status, body } = await parseResponse(await send());

    expect(status).toBe(500);
    expect(body).toEqual({ success: false, error: "Connection test failed" });
    expectNoInternals(body);
    expect(logger.error).toHaveBeenCalledWith(
      "POST /api/admin/settings/freshdesk/test error",
      { error: failure },
    );
  });
});

describe("POST /api/admin/settings/storage/test", () => {
  const send = () =>
    testStorage(
      createMockRequest("/api/admin/settings/storage/test", {
        method: "POST",
        body: {
          endpoint: "https://s3.example.test",
          bucket: "assets",
          accessKey: "AK",
          secretKey: "SK",
        },
      }),
    );

  it("answers a failed connection with a fixed reason and logs the details", async () => {
    const failure = new Error(INTERNAL);
    s3.upload.mockRejectedValue(failure);

    const { status, body } = await parseResponse(await send());

    expect(status).toBe(200);
    expect(body).toEqual({
      success: false,
      error: "Connection failed. Check the endpoint, bucket and credentials.",
    });
    expectNoInternals(body);
    expect(logger.error).toHaveBeenCalledWith(
      "POST /api/admin/settings/storage/test error",
      { error: failure },
    );
  });

  it("reports success when the upload and delete work", async () => {
    s3.upload.mockResolvedValue(undefined);
    s3.remove.mockResolvedValue(undefined);

    const { body } = await parseResponse(await send());

    expect(body).toEqual({ success: true });
  });
});

describe("GET /api/admin/settings/storage", () => {
  it("answers an unexpected error with a fixed body, not the raw message", async () => {
    mockPrisma.organizationStorageConfig.findUnique.mockRejectedValue(
      new Error(INTERNAL),
    );

    const { status, body } = await parseResponse(await getStorage());

    expect(status).toBe(500);
    expect(body).toEqual({ error: "Failed to load storage config" });
    expectNoInternals(body);
    expect(logger.error).toHaveBeenCalledWith("Storage config load failed", {
      error: expect.any(Error),
    });
  });

  it("keeps the actionable answer for a missing table", async () => {
    mockPrisma.organizationStorageConfig.findUnique.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("table missing", {
        code: "P2021",
        clientVersion: "test",
      }),
    );

    const { status, body } = await parseResponse<{ code: string }>(
      await getStorage(),
    );

    expect(status).toBe(500);
    expect(body.code).toBe("table_missing");
  });

  it("keeps the actionable answer for a missing encryption key", async () => {
    mockPrisma.organizationStorageConfig.findUnique.mockRejectedValue(
      new Error("ENCRYPTION_KEY is required"),
    );

    const { status, body } = await parseResponse<{ code: string }>(
      await getStorage(),
    );

    expect(status).toBe(503);
    expect(body.code).toBe("encryption_key_absent");
  });
});

describe("PUT /api/asset/updateStatus", () => {
  const send = () =>
    updateStatus(
      createMockRequest("/api/asset/updateStatus", {
        method: "PUT",
        body: { assetId: "asset-1", statusTypeId: "status-1" },
      }) as never,
    );

  beforeEach(() => {
    mockPrisma.asset.findFirst.mockResolvedValue({
      assetid: "asset-1",
    } as never);
  });

  it("answers an unexpected error with a fixed body and no error code", async () => {
    const failure = new Error(
      `Invalid \`prisma.asset.update()\` invocation: ${INTERNAL}`,
    );
    mockPrisma.$transaction.mockRejectedValue(failure);

    const { status, body } = await parseResponse(await send());

    expect(status).toBe(500);
    expect(body).toEqual({ error: "Failed to update status" });
    expectNoInternals(body);
    expect(logger.apiError).toHaveBeenCalledWith(
      "PUT",
      "/api/asset/updateStatus",
      failure,
      expect.any(Object),
    );
  });

  it("answers a Prisma error carrying a code with a fixed 500 body", async () => {
    mockPrisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        `Unique constraint: ${INTERNAL}`,
        {
          code: "P2002",
          clientVersion: "test",
        },
      ),
    );

    const { status, body } = await parseResponse(await send());

    expect(status).toBe(500);
    expect(body).toEqual({ error: "Failed to update status" });
    expectNoInternals(body);
  });

  it("keeps the 404 for a record that disappeared", async () => {
    mockPrisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("not found", {
        code: "P2025",
        clientVersion: "test",
      }),
    );

    const { status, body } = await parseResponse(await send());

    expect(status).toBe(404);
    expect(body).toEqual({ error: "Asset not found" });
  });

  it("keeps the 400 for a status that does not exist", async () => {
    mockPrisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("fk", {
        code: "P2003",
        clientVersion: "test",
      }),
    );

    const { status, body } = await parseResponse(await send());

    expect(status).toBe(400);
    expect(body).toEqual({
      error: "Invalid status ID - status does not exist",
    });
  });
});

describe("POST /api/userAssets/assign", () => {
  it("does not expose the internal status-lookup message", async () => {
    mockPrisma.$transaction.mockRejectedValue(
      new Error("Status 'Active' not found in statusType"),
    );

    const { status, body } = await parseResponse(
      await assignAsset(
        createMockRequest("/api/userAssets/assign", {
          method: "POST",
          body: { assetId: "asset-1", userId: "user-1" },
        }),
      ),
    );

    expect(status).toBe(500);
    expect(body).toEqual({
      error: "The 'Active' status is not configured for this organization",
    });
    expect(JSON.stringify(body)).not.toContain("statusType");
  });
});

describe("GET /api/user/getUser", () => {
  it("answers an unexpected error with a fixed body and logs the details", async () => {
    const failure = new Error(INTERNAL);
    mockPrisma.user.findMany.mockRejectedValue(failure);

    const { status, body } = await parseResponse(await getUsers());

    expect(status).toBe(500);
    expect(body).toEqual({ error: "Failed to fetch users" });
    expectNoInternals(body);
    expect(logger.error).toHaveBeenCalledWith("GET /api/user/getUser error", {
      error: failure,
    });
  });
});

describe("GET /api/health/ready", () => {
  it("answers a database failure with a fixed reason and logs the details", async () => {
    const failure = new Error(INTERNAL);
    mockPrisma.$queryRaw.mockRejectedValue(failure);

    const { status, body } = await parseResponse<{
      status: string;
      error: string;
    }>(await getReady());

    expect(status).toBe(503);
    expect(body.status).toBe("not ready");
    expect(body.error).toBe("Database connection failed");
    expectNoInternals(body);
    expect(logger.error).toHaveBeenCalledWith("Readiness check failed", {
      error: failure,
    });
  });
});
