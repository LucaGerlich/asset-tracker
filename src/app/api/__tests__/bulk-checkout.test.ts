import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

// Mock all dependencies BEFORE importing the route
vi.mock("@/lib/prisma");

vi.mock("@/lib/api-auth");

vi.mock("@/lib/validation", () => ({
  validateBody: vi.fn((_schema: any, body: any) => body),
  bulkCheckoutSchema: {},
}));

vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { CREATE: "CREATE" },
  AUDIT_ENTITIES: { ASSET: "ASSET" },
}));

vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/integrations/slack-teams", () => ({
  notifyIntegrations: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger");

// Import route handler and mocked modules AFTER mocks
import { POST } from "@/app/api/asset/checkout/bulk/route";
import prisma from "@/lib/prisma";
import { requireApiAuth, requirePermission } from "@/lib/api-auth";

const mockPrisma = vi.mocked(prisma);
const mockRequireApiAuth = vi.mocked(requireApiAuth);
const mockRequirePermission = vi.mocked(requirePermission);

beforeEach(() => {
  vi.clearAllMocks();
  // Default: authenticated admin user
  mockRequireApiAuth.mockResolvedValue({ id: "admin-uuid-001" } as any);
});

const bulkCheckoutUrl = "/api/asset/checkout/bulk";

describe("POST /api/asset/checkout/bulk", () => {
  it("returns 201 with success array when checking out to a user", async () => {
    // Target user exists
    mockPrisma.user.findFirst.mockResolvedValue({
      userid: "user-uuid-001",
      firstname: "John",
      lastname: "Doe",
    } as any);

    // Both assets found
    const assets = [
      { assetid: "asset-001", assetname: "Laptop A", assettag: "L-001" },
      { assetid: "asset-002", assetname: "Laptop B", assettag: "L-002" },
    ];
    mockPrisma.asset.findMany.mockResolvedValue(assets as any);

    // Each assetCheckout.create returns a checkout record
    mockPrisma.assetCheckout.create
      .mockResolvedValueOnce({
        id: "co-1",
        assetId: "asset-001",
        status: "checked_out",
      } as any)
      .mockResolvedValueOnce({
        id: "co-2",
        assetId: "asset-002",
        status: "checked_out",
      } as any);

    const req = createMockRequest(bulkCheckoutUrl, {
      method: "POST",
      body: {
        assetIds: ["asset-001", "asset-002"],
        checkedOutToType: "user",
        checkedOutTo: "user-uuid-001",
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(201);
    expect(body.success).toHaveLength(2);
    expect(body.failed).toHaveLength(0);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.assetCheckout.create).toHaveBeenCalledTimes(2);
  });

  it("returns 404 when target user not found", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const req = createMockRequest(bulkCheckoutUrl, {
      method: "POST",
      body: {
        assetIds: ["asset-001"],
        checkedOutToType: "user",
        checkedOutTo: "nonexistent-user",
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(404);
    expect(body.error).toBe("Target user not found");
    expect(mockPrisma.asset.findMany).not.toHaveBeenCalled();
  });

  it("returns 404 when target location not found", async () => {
    mockPrisma.location.findFirst.mockResolvedValue(null);

    const req = createMockRequest(bulkCheckoutUrl, {
      method: "POST",
      body: {
        assetIds: ["asset-001"],
        checkedOutToType: "location",
        checkedOutToLocationId: "nonexistent-loc",
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(404);
    expect(body.error).toBe("Target location not found");
    expect(mockPrisma.asset.findMany).not.toHaveBeenCalled();
  });

  it("returns 400 when checking out an asset to itself", async () => {
    // Target asset exists
    mockPrisma.asset.findFirst.mockResolvedValue({
      assetid: "asset-001",
      assetname: "Laptop A",
      assettag: "L-001",
    } as any);

    // findMany returns the same asset that is the target
    mockPrisma.asset.findMany.mockResolvedValue([
      { assetid: "asset-001", assetname: "Laptop A", assettag: "L-001" },
    ] as any);

    const req = createMockRequest(bulkCheckoutUrl, {
      method: "POST",
      body: {
        assetIds: ["asset-001"],
        checkedOutToType: "asset",
        checkedOutToAssetId: "asset-001",
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(400);
    expect(body.error).toBe("Cannot check out an asset to itself");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 201 with mixed success/failed when some asset IDs don't exist", async () => {
    // Target user exists
    mockPrisma.user.findFirst.mockResolvedValue({
      userid: "user-uuid-001",
      firstname: "Jane",
      lastname: "Smith",
    } as any);

    // Only one of the two assets is found
    mockPrisma.asset.findMany.mockResolvedValue([
      { assetid: "asset-001", assetname: "Laptop A", assettag: "L-001" },
    ] as any);

    mockPrisma.assetCheckout.create.mockResolvedValueOnce({
      id: "co-1",
      assetId: "asset-001",
      status: "checked_out",
    } as any);

    const req = createMockRequest(bulkCheckoutUrl, {
      method: "POST",
      body: {
        assetIds: ["asset-001", "asset-missing"],
        checkedOutToType: "user",
        checkedOutTo: "user-uuid-001",
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(201);
    expect(body.success).toHaveLength(1);
    expect(body.failed).toHaveLength(1);
    expect(body.failed[0]).toEqual({
      assetId: "asset-missing",
      reason: "Asset not found",
    });
  });

  it("returns 401 when unauthorized", async () => {
    mockRequirePermission.mockRejectedValue(new Error("Unauthorized"));

    const req = createMockRequest(bulkCheckoutUrl, {
      method: "POST",
      body: {
        assetIds: ["asset-001"],
        checkedOutToType: "user",
        checkedOutTo: "user-uuid-001",
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });
});
