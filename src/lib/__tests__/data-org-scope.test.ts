import { describe, it, expect, vi, beforeEach } from "vitest";

// Automock for the Prisma client (see src/lib/__mocks__/prisma.ts).
vi.mock("@/lib/prisma");

vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn(),
}));

import { getAssetById } from "@/lib/data";
import prisma from "@/lib/prisma";
import { getOrganizationContext } from "@/lib/organization-context";

const mockPrisma = vi.mocked(prisma);
const mockGetOrgContext = vi.mocked(getOrganizationContext);

const ORG_ID = "org-uuid-001";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOrgContext.mockResolvedValue({
    organization: { id: ORG_ID, name: "Acme", slug: "acme", settings: null },
    userId: "user-uuid-001",
    departmentId: null,
    isAdmin: false,
    permissions: new Set(),
  } as any);
});

describe("data.ts org scoping — getAssetById", () => {
  it("scopes the lookup to the caller's organization", async () => {
    mockPrisma.asset.findFirst.mockResolvedValue({
      assetid: "asset-1",
      organizationId: ORG_ID,
    } as any);

    await getAssetById("asset-1");

    expect(mockPrisma.asset.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assetid: "asset-1",
          organizationId: ORG_ID,
        }),
      }),
    );
  });

  it("throws when the asset does not belong to the caller's organization", async () => {
    // A cross-org UUID guess resolves to no row once findFirst is scoped.
    mockPrisma.asset.findFirst.mockResolvedValue(null);

    await expect(getAssetById("asset-1")).rejects.toThrow();
  });

  it("throws (fails closed) when there is no organization context", async () => {
    mockGetOrgContext.mockResolvedValue(null);

    await expect(getAssetById("asset-1")).rejects.toThrow(
      "Organization context required",
    );
  });
});
