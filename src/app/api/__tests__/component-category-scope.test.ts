import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

/**
 * Component categories carry an organizationId. Every handler must read and
 * write within the caller's organization so one tenant can neither list nor
 * rename another tenant's categories, and new categories land in the caller's
 * organization (not org-less, where the tenant's own pages never show them).
 */

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");

vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  invalidateCacheByPrefix: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { CREATE: "create", UPDATE: "update", DELETE: "delete" },
  AUDIT_ENTITIES: { COMPONENT_CATEGORY: "component_category" },
}));

import { GET, POST, PUT } from "@/app/api/componentCategory/route";
import prisma from "@/lib/prisma";
import { getOrganizationContext } from "@/lib/organization-context";

const mockPrisma = vi.mocked(prisma, true);
const mockOrgContext = vi.mocked(getOrganizationContext);

const CALLER_ORG = "org-uuid-001";
const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";

function callerIn(organizationId: string | null) {
  mockOrgContext.mockResolvedValue(
    organizationId
      ? ({ organization: { id: organizationId } } as Awaited<
          ReturnType<typeof getOrganizationContext>
        >)
      : null,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  callerIn(CALLER_ORG);
});

describe("GET /api/componentCategory", () => {
  it("lists only the caller's organization", async () => {
    await GET();

    expect(mockPrisma.componentCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: CALLER_ORG } }),
    );
  });

  it("limits an org-less caller to org-less categories", async () => {
    callerIn(null);

    await GET();

    expect(mockPrisma.componentCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: null } }),
    );
  });
});

describe("POST /api/componentCategory", () => {
  it("creates the category in the caller's organization", async () => {
    mockPrisma.componentCategory.create.mockResolvedValue({
      id: CATEGORY_ID,
      name: "RAM",
      organizationId: CALLER_ORG,
    });

    const res = await POST(
      createMockRequest("/api/componentCategory", {
        method: "POST",
        body: { name: "RAM" },
      }),
    );

    expect(res.status).toBe(201);
    expect(mockPrisma.componentCategory.create).toHaveBeenCalledWith({
      data: { name: "RAM", organizationId: CALLER_ORG },
    });
  });
});

describe("PUT /api/componentCategory", () => {
  const put = () =>
    PUT(
      createMockRequest("/api/componentCategory", {
        method: "PUT",
        body: { id: CATEGORY_ID, name: "Renamed" },
      }),
    );

  it("answers 404 for a category outside the caller's organization", async () => {
    mockPrisma.componentCategory.findFirst.mockResolvedValue(null);

    const { status } = await parseResponse(await put());

    expect(status).toBe(404);
    expect(mockPrisma.componentCategory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CATEGORY_ID, organizationId: CALLER_ORG },
      }),
    );
    expect(mockPrisma.componentCategory.update).not.toHaveBeenCalled();
  });

  it("renames a category of the caller's organization", async () => {
    mockPrisma.componentCategory.findFirst.mockResolvedValue({
      id: CATEGORY_ID,
    } as Awaited<ReturnType<typeof prisma.componentCategory.findFirst>>);
    mockPrisma.componentCategory.update.mockResolvedValue({
      id: CATEGORY_ID,
      name: "Renamed",
      organizationId: CALLER_ORG,
    });

    const { status } = await parseResponse(await put());

    expect(status).toBe(200);
    expect(mockPrisma.componentCategory.update).toHaveBeenCalledWith({
      where: { id: CATEGORY_ID },
      data: { name: "Renamed" },
    });
  });
});
