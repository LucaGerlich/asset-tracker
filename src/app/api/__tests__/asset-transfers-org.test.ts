import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

/**
 * Moving an asset into another organization is a platform-level action: only a
 * super-admin may do it, and only into an organization that exists. Tenant
 * admins keep user and location transfers inside their own organization.
 */

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");

vi.mock("@/lib/super-admin", () => ({
  isSuperAdmin: vi.fn(),
}));

import { POST } from "@/app/api/asset/transfers/route";
import prisma from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/super-admin";

const mockPrisma = vi.mocked(prisma, true);
const mockIsSuperAdmin = vi.mocked(isSuperAdmin);

const CALLER_ORG = "org-uuid-001";
const ASSET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_ORG = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LOCATION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const transfer = (body: Record<string, unknown>) =>
  POST(
    createMockRequest("/api/asset/transfers", {
      method: "POST",
      body: { assetId: ASSET_ID, ...body },
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockIsSuperAdmin.mockResolvedValue(false);
  mockPrisma.asset.findFirst.mockResolvedValue({
    assetid: ASSET_ID,
    organizationId: CALLER_ORG,
    locationid: null,
  } as Awaited<ReturnType<typeof prisma.asset.findFirst>>);
  mockPrisma.organization.findUnique.mockResolvedValue({
    id: OTHER_ORG,
  } as Awaited<ReturnType<typeof prisma.organization.findUnique>>);
});

describe("POST /api/asset/transfers organization transfers", () => {
  it("rejects a tenant admin with 403 and moves nothing", async () => {
    const { status } = await parseResponse(
      await transfer({ transferType: "organization", toOrgId: OTHER_ORG }),
    );

    expect(status).toBe(403);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("answers 404 when the target organization does not exist", async () => {
    mockIsSuperAdmin.mockResolvedValue(true);
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    const { status } = await parseResponse(
      await transfer({ transferType: "organization", toOrgId: OTHER_ORG }),
    );

    expect(status).toBe(404);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("answers 400 when the asset already belongs to the target", async () => {
    mockIsSuperAdmin.mockResolvedValue(true);
    mockPrisma.asset.findFirst.mockResolvedValue({
      assetid: ASSET_ID,
      organizationId: OTHER_ORG,
      locationid: null,
    } as Awaited<ReturnType<typeof prisma.asset.findFirst>>);

    const { status } = await parseResponse(
      await transfer({ transferType: "organization", toOrgId: OTHER_ORG }),
    );

    expect(status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("answers 400 when toOrgId is missing", async () => {
    mockIsSuperAdmin.mockResolvedValue(true);

    const { status } = await parseResponse(
      await transfer({ transferType: "organization" }),
    );

    expect(status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a toOrgId that is not a UUID", async () => {
    mockIsSuperAdmin.mockResolvedValue(true);

    const { status } = await parseResponse(
      await transfer({ transferType: "organization", toOrgId: "not-a-uuid" }),
    );

    expect(status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("lets a super-admin move the asset into an existing organization", async () => {
    mockIsSuperAdmin.mockResolvedValue(true);

    const { status } = await parseResponse(
      await transfer({ transferType: "organization", toOrgId: OTHER_ORG }),
    );

    expect(status).toBe(201);
    expect(mockPrisma.asset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assetid: ASSET_ID },
        data: expect.objectContaining({ organizationId: OTHER_ORG }),
      }),
    );
  });
});

describe("POST /api/asset/transfers location transfers", () => {
  it("still works for a tenant admin inside their organization", async () => {
    mockPrisma.location.findFirst.mockResolvedValue({
      locationid: LOCATION_ID,
    } as Awaited<ReturnType<typeof prisma.location.findFirst>>);

    const { status } = await parseResponse(
      await transfer({ transferType: "location", toLocationId: LOCATION_ID }),
    );

    expect(status).toBe(201);
    expect(mockIsSuperAdmin).not.toHaveBeenCalled();
  });
});
