import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

/**
 * The last cross-tenant leftovers (TECHNICAL_DEBT items 89 and 90): soft
 * references (kit items, audit-campaign scopes, approval entities) must belong
 * to the caller's organization when they are stored, "global" saved filters
 * are global within one organization only, and SCIM provisioning counts users
 * against the token's organization. Items 83/84 are covered in
 * asset-transfers.test.ts and component-category-scope.test.ts.
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
vi.mock("@/lib/cache", () => ({
  cached: vi.fn((_key: string, fn: () => unknown) => fn()),
  invalidateCacheByPrefix: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { CREATE: "create", UPDATE: "update", REQUEST: "request" },
  AUDIT_ENTITIES: {},
}));
vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/integrations/slack-teams", () => ({
  notifyIntegrations: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/tenant-limits", () => ({
  checkUserLimit: vi
    .fn()
    .mockResolvedValue({ allowed: false, current: 5, max: 5 }),
}));
vi.mock("@/lib/scim", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scim")>()),
  authenticateScim: vi
    .fn()
    .mockResolvedValue({ organizationId: "org-uuid-001" }),
}));

import {
  POST as createKit,
  PUT as updateKitLegacy,
} from "@/app/api/kits/route";
import { PUT as updateKit } from "@/app/api/kits/[id]/route";
import { POST as createAudit } from "@/app/api/audits/route";
import { PUT as updateAudit } from "@/app/api/audits/[id]/route";
import { POST as requestApproval } from "@/app/api/approvals/route";
import { GET as listFilters } from "@/app/api/saved-filters/route";
import { POST as scimCreateUser } from "@/app/api/scim/v2/Users/route";
import prisma from "@/lib/prisma";
import { checkUserLimit } from "@/lib/tenant-limits";
import { requireApiAuth } from "@/lib/api-auth";

const mockPrisma = vi.mocked(prisma, true);

const CALLER_ORG = "org-uuid-001";
const FOREIGN_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const KIT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const post = (url: string, body: Record<string, unknown>, method = "POST") =>
  createMockRequest(url, { method, body });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("kit items (item 89)", () => {
  it("POST refuses an item that belongs to another organization", async () => {
    const { status } = await parseResponse(
      await createKit(
        post("/api/kits", {
          name: "Onboarding",
          items: [{ entityType: "accessory", entityId: FOREIGN_ID }],
        }),
      ),
    );

    expect(status).toBe(400);
    expect(mockPrisma.accessories.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          accessorieid: { in: [FOREIGN_ID] },
          organizationId: CALLER_ORG,
        },
      }),
    );
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("legacy PUT /api/kits refuses an item that belongs to another organization", async () => {
    const { status } = await parseResponse(
      await updateKitLegacy(
        post(
          "/api/kits",
          {
            id: KIT_ID,
            items: [{ entityType: "licence", entityId: FOREIGN_ID }],
          },
          "PUT",
        ),
      ),
    );

    expect(status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("PUT refuses an item that belongs to another organization", async () => {
    mockPrisma.kit.findFirst.mockResolvedValue({ id: KIT_ID } as never);

    const { status } = await parseResponse(
      await updateKit(
        post(
          `/api/kits/${KIT_ID}`,
          { items: [{ entityType: "component", entityId: FOREIGN_ID }] },
          "PUT",
        ),
        { params: Promise.resolve({ id: KIT_ID }) },
      ),
    );

    expect(status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("audit campaign scope (item 89)", () => {
  it("POST refuses a location scope of another organization", async () => {
    const { status } = await parseResponse(
      await createAudit(
        post("/api/audits", {
          name: "Q4",
          scopeType: "location",
          scopeId: FOREIGN_ID,
        }),
      ),
    );

    expect(status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("PUT refuses a category scope of another organization", async () => {
    mockPrisma.auditCampaign.findFirst.mockResolvedValue({
      id: KIT_ID,
      scopeType: "all",
      scopeId: null,
    } as never);

    const { status } = await parseResponse(
      await updateAudit(
        post(
          `/api/audits/${KIT_ID}`,
          { scopeType: "category", scopeId: FOREIGN_ID },
          "PUT",
        ),
        { params: Promise.resolve({ id: KIT_ID }) },
      ),
    );

    expect(status).toBe(400);
    expect(mockPrisma.assetCategoryType.findMany).toHaveBeenCalled();
    expect(mockPrisma.auditCampaign.update).not.toHaveBeenCalled();
  });
});

describe("audit campaign edits keep their scope", () => {
  it("a rename-only PUT does not reset the scope to 'all'", async () => {
    mockPrisma.auditCampaign.findFirst.mockResolvedValue({
      id: KIT_ID,
      scopeType: "location",
      scopeId: FOREIGN_ID,
    } as never);
    mockPrisma.location.findMany.mockResolvedValue([
      { locationid: FOREIGN_ID },
    ] as never);
    mockPrisma.auditCampaign.update.mockResolvedValue({
      id: KIT_ID,
      name: "Renamed",
    } as never);

    const { status } = await parseResponse(
      await updateAudit(
        post(`/api/audits/${KIT_ID}`, { name: "Renamed" }, "PUT"),
        { params: Promise.resolve({ id: KIT_ID }) },
      ),
    );

    expect(status).toBe(200);
    expect(mockPrisma.auditCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: KIT_ID, organizationId: CALLER_ORG },
        data: { name: "Renamed" },
      }),
    );
  });
});

describe("approval requests (item 89)", () => {
  it("answers 404 for an entity outside the caller's organization", async () => {
    const { status } = await parseResponse(
      await requestApproval(
        post("/api/approvals", {
          entityType: "reservation",
          entityId: FOREIGN_ID,
        }),
      ),
    );

    expect(status).toBe(404);
    expect(mockPrisma.assetReservation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: FOREIGN_ID, asset: { organizationId: CALLER_ORG } },
      }),
    );
    expect(mockPrisma.approvalRequest.create).not.toHaveBeenCalled();
  });
});

describe("saved filters (item 90)", () => {
  it("returns global filters of the caller's organization only", async () => {
    await listFilters(
      new Request("http://localhost:3000/api/saved-filters?entity=asset"),
    );

    expect(mockPrisma.saved_filters.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          entity: "asset",
          OR: [
            { userId: "admin-uuid-001" },
            { isGlobal: true, user: { organizationId: CALLER_ORG } },
          ],
        },
      }),
    );
  });
});

describe("saved filters for a caller without an organization (item 90)", () => {
  it("shares no global filters", async () => {
    vi.mocked(requireApiAuth).mockResolvedValueOnce({
      id: "orgless-user",
      organizationId: null,
    } as never);

    await listFilters(
      new Request("http://localhost:3000/api/saved-filters?entity=asset"),
    );

    expect(mockPrisma.saved_filters.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entity: "asset", OR: [{ userId: "orgless-user" }] },
      }),
    );
  });
});

describe("SCIM user limit (item 90)", () => {
  it("counts users against the token's organization", async () => {
    const { status } = await parseResponse(
      await scimCreateUser(
        createMockRequest("http://localhost:3000/api/scim/v2/Users", {
          method: "POST",
          body: {
            schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
            userName: "jdoe",
            name: { givenName: "John", familyName: "Doe" },
          },
        }),
      ),
    );

    expect(checkUserLimit).toHaveBeenCalledWith(CALLER_ORG);
    expect(status).toBe(403);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });
});
