import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

/**
 * Read paths from the 2026-11 audit: the compliance export must count only the
 * caller's organization's audit log, and the asset-tag suggestion must not
 * read the names of another organization's category, manufacturer or model.
 */

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");

vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn().mockResolvedValue({
    organization: { id: "org-uuid-001" },
  }),
  scopeToOrganization: vi.fn((where: Record<string, unknown>) => ({
    ...where,
    organizationId: "org-uuid-001",
  })),
}));

import { GET as exportCompliance } from "@/app/api/admin/compliance/export/route";
import { GET as nextTag } from "@/app/api/asset/nextTag/route";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, true);
const CALLER_ORG = "org-uuid-001";
const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/compliance/export", () => {
  it("counts and groups only the caller's organization's audit log", async () => {
    await exportCompliance();

    const scoped = { user: { organizationId: CALLER_ORG } };
    expect(mockPrisma.audit_logs.count).toHaveBeenCalledWith({ where: scoped });
    for (const [args] of mockPrisma.audit_logs.findFirst.mock.calls) {
      expect(args?.where).toEqual(scoped);
    }
    // Prisma's groupBy generics are too deep for vi.mocked(); read the calls
    // through a plain mock type instead.
    const groupBy = (
      prisma.audit_logs as unknown as { groupBy: ReturnType<typeof vi.fn> }
    ).groupBy;
    const groupByCalls = groupBy.mock.calls as [{ where?: unknown }][];
    expect(groupByCalls).toHaveLength(2);
    for (const [args] of groupByCalls) {
      expect(args.where).toEqual(scoped);
    }
  });
});

describe("GET /api/asset/nextTag", () => {
  it("looks names up within the caller's organization", async () => {
    await nextTag(
      createMockRequest(`/api/asset/nextTag?categoryId=${CATEGORY_ID}`),
    );

    expect(mockPrisma.assetCategoryType.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assetcategorytypeid: CATEGORY_ID, organizationId: CALLER_ORG },
      }),
    );
    expect(mockPrisma.assetCategoryType.findUnique).not.toHaveBeenCalled();
  });
});
