import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";
import {
  mockAsset,
  mockAssetList,
} from "../../../../tests/setup/fixtures/assets";

// Mock all dependencies. The bare vi.mock uses src/lib/__mocks__/prisma.ts,
// which auto-generates every model/method (so routes using findFirst, audit_logs,
// $executeRawUnsafe, etc. don't hit undefined methods).
vi.mock("@/lib/prisma");

vi.mock("@/lib/api-auth", () => ({
  requireApiAuth: vi.fn(),
  requirePermission: vi.fn(),
  requireNotDemoMode: vi.fn().mockReturnValue(null),
  requireWritableOrg: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn().mockResolvedValue({
    organization: { id: "org-uuid-001" },
  }),
  scopeToOrganization: vi.fn((where: any) => ({
    ...where,
    organizationId: "org-uuid-001",
  })),
}));

vi.mock("@/lib/tenant-limits", () => ({
  checkAssetLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, current: 5, max: 100 }),
}));

vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger");

import { GET, POST, PUT } from "@/app/api/asset/route";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/api-auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { checkAssetLimit } from "@/lib/tenant-limits";

const mockPrisma = vi.mocked(prisma, true);
const mockRequirePermission = vi.mocked(requirePermission);

beforeEach(() => {
  vi.clearAllMocks();
  // Default: authenticated admin user
  mockRequirePermission.mockResolvedValue({
    id: "admin-uuid-001",
    isAdmin: true,
    organizationId: "org-uuid-001",
  } as any);
  vi.mocked(checkAssetLimit).mockResolvedValue({
    allowed: true,
    current: 5,
    max: 100,
  });
});

describe("GET /api/asset", () => {
  it("returns all assets when no page param", async () => {
    mockPrisma.asset.findMany.mockResolvedValue(mockAssetList as any);

    const req = createMockRequest("/api/asset");
    const res = await GET(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
  });

  it("returns paginated assets when page param is set", async () => {
    mockPrisma.asset.findMany.mockResolvedValue(mockAssetList as any);
    mockPrisma.asset.count.mockResolvedValue(2);

    const req = createMockRequest("/api/asset?page=1&pageSize=25");
    const res = await GET(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.page).toBe(1);
  });

  it("returns single asset by id", async () => {
    mockPrisma.asset.findFirst.mockResolvedValue(mockAsset as any);

    const req = createMockRequest("/api/asset?id=asset-uuid-001");
    const res = await GET(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(200);
    expect(body.assetid).toBe("asset-uuid-001");
  });

  it("returns 404 when asset not found by id", async () => {
    mockPrisma.asset.findFirst.mockResolvedValue(null);

    const req = createMockRequest("/api/asset?id=nonexistent");
    const res = await GET(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequirePermission.mockRejectedValue(new UnauthorizedError());

    const req = createMockRequest("/api/asset");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user lacks permission", async () => {
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("insufficient_permission", "Insufficient permissions"),
    );

    const req = createMockRequest("/api/asset");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/asset", () => {
  it("creates an asset with valid data", async () => {
    mockPrisma.asset.create.mockResolvedValue({
      ...mockAsset,
      assetid: "new-asset-uuid",
    } as any);

    const req = createMockRequest("/api/asset", {
      method: "POST",
      body: {
        assetname: "New Asset",
        assettag: "NEW-001",
        serialnumber: "SN-NEW-001",
      },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(201);
    expect(mockPrisma.asset.create).toHaveBeenCalled();
  });

  it("returns 403 when asset limit reached", async () => {
    vi.mocked(checkAssetLimit).mockResolvedValue({
      allowed: false,
      current: 100,
      max: 100,
    });

    const req = createMockRequest("/api/asset", {
      method: "POST",
      body: {
        assetname: "Over Limit",
        assettag: "OL-001",
        serialnumber: "SN-OL-001",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequirePermission.mockRejectedValue(new UnauthorizedError());

    const req = createMockRequest("/api/asset", {
      method: "POST",
      body: {
        assetname: "Test",
        assettag: "T-001",
        serialnumber: "SN-001",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/asset", () => {
  it("updates an asset with valid data", async () => {
    const assetUuid = "550e8400-e29b-41d4-a716-446655440000";
    // The route verifies the asset belongs to the org via findFirst before update,
    // then updates using the resolved record's id.
    mockPrisma.asset.findFirst.mockResolvedValue({
      ...mockAsset,
      assetid: assetUuid,
    } as any);
    mockPrisma.asset.update.mockResolvedValue({
      ...mockAsset,
      assetid: assetUuid,
      assetname: "Updated Name",
    } as any);

    const req = createMockRequest("/api/asset", {
      method: "PUT",
      body: {
        assetid: assetUuid,
        assetname: "Updated Name",
      },
    });
    const res = await PUT(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
    expect(mockPrisma.asset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assetid: assetUuid },
      }),
    );
  });

  it("returns 401 when not authenticated", async () => {
    mockRequirePermission.mockRejectedValue(new UnauthorizedError());

    const req = createMockRequest("/api/asset", {
      method: "PUT",
      body: {
        assetid: "550e8400-e29b-41d4-a716-446655440000",
        assetname: "Updated",
      },
    });
    const res = await PUT(req);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/asset full-text search", () => {
  it("scopes the raw tsvector query to the caller's organization and limits it", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ assetid: "a-1" }]);
    mockPrisma.asset.findMany.mockResolvedValue([mockAsset] as any);

    const res = await GET(createMockRequest("/api/asset?search=laptop") as any);

    expect(res.status).toBe(200);
    const [sql, ...params] = mockPrisma.$queryRawUnsafe.mock.calls[0] as [
      string,
      ...unknown[],
    ];
    expect(sql).toContain('"organizationId" = $2');
    expect(sql).toContain("LIMIT 1001");
    expect(params).toEqual(["laptop", "org-uuid-001"]);
  });

  it("flags a paginated search whose matches were capped", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue(
      Array.from({ length: 1001 }, (_, i) => ({ assetid: `a-${i}` })),
    );
    mockPrisma.asset.findMany.mockResolvedValue([mockAsset] as any);
    mockPrisma.asset.count.mockResolvedValue(1000);

    const res = await GET(
      createMockRequest("/api/asset?page=1&search=laptop") as any,
    );
    const { body } = await parseResponse<any>(res);

    expect(body.truncated).toBe(true);
  });

  it("omits truncated for a complete search result", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ assetid: "a-1" }]);
    mockPrisma.asset.findMany.mockResolvedValue([mockAsset] as any);
    mockPrisma.asset.count.mockResolvedValue(1);

    const res = await GET(
      createMockRequest("/api/asset?page=1&search=laptop") as any,
    );
    const { body } = await parseResponse<any>(res);

    expect(body).not.toHaveProperty("truncated");
  });
});

describe("duplicate assettag / serialnumber", () => {
  const uniqueViolation = () =>
    Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

  it("POST maps a unique-constraint violation to 409", async () => {
    mockPrisma.asset.create.mockRejectedValue(uniqueViolation());

    const res = await POST(
      createMockRequest("/api/asset", {
        method: "POST",
        body: {
          assetname: "Dup",
          assettag: "DUP-001",
          serialnumber: "SN-DUP-001",
        },
      }),
    );
    const { status, body } = await parseResponse<{ error: string }>(res);

    expect(status).toBe(409);
    expect(body.error).toMatch(/already exists/);
  });

  it("PUT maps a unique-constraint violation to 409", async () => {
    const assetUuid = "550e8400-e29b-41d4-a716-446655440000";
    mockPrisma.asset.findFirst.mockResolvedValue({
      ...mockAsset,
      assetid: assetUuid,
    } as any);
    mockPrisma.asset.update.mockRejectedValue(uniqueViolation());

    const res = await PUT(
      createMockRequest("/api/asset", {
        method: "PUT",
        body: { assetid: assetUuid, assettag: "TAKEN-001" },
      }),
    );

    expect(res.status).toBe(409);
  });
});
