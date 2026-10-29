import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

/**
 * Checkout, seat and audit routes write user, asset and location ids taken
 * from the request body. Each must belong to the caller's organization, or a
 * tenant could hand its stock to another tenant's user (and read that user's
 * name and email back), or log a foreign asset in its audit campaign.
 */

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");

vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn(),
  scopeToOrganization: vi.fn(
    (where: Record<string, unknown>, organizationId?: string | null) => ({
      ...where,
      organizationId: organizationId || null,
    }),
  ),
}));

vi.mock("@/lib/audit-log", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audit-log")>()),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/cache", () => ({
  invalidateCacheByPrefix: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/integrations/slack-teams", () => ({
  notifyIntegrations: vi.fn().mockResolvedValue(undefined),
}));

import { POST as checkoutConsumable } from "@/app/api/consumable/checkout/route";
import { POST as assignSeat } from "@/app/api/licence/seats/route";
import { POST as createAudit } from "@/app/api/audits/route";
import { POST as scanAsset } from "@/app/api/audits/[id]/scan/route";
import prisma from "@/lib/prisma";
import { getOrganizationContext } from "@/lib/organization-context";

const mockPrisma = vi.mocked(prisma, true);
const mockOrgContext = vi.mocked(getOrganizationContext);

const CALLER_ORG = "org-uuid-001";
const RECORD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const ASSET_ID = "33333333-3333-4333-8333-333333333333";
const LOCATION_ID = "44444444-4444-4444-8444-444444444444";

type MockFn = ReturnType<typeof vi.fn>;

// findMany echoes the requested ids, i.e. every id is in the organization.
function echoIds(model: "user" | "asset" | "location") {
  (mockPrisma[model].findMany as unknown as MockFn).mockImplementation(
    async (args: {
      where: Record<string, { in: string[] }>;
      select: Record<string, true>;
    }) => {
      const [idField] = Object.keys(args.select);
      return args.where[idField].in.map((id) => ({ [idField]: id }));
    },
  );
}

const post = (body: Record<string, unknown>) =>
  createMockRequest("/api/test", { method: "POST", body });

const scanContext = { params: Promise.resolve({ id: RECORD_ID }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockOrgContext.mockResolvedValue({
    organization: { id: CALLER_ORG },
    userId: "admin-uuid-001",
  } as Awaited<ReturnType<typeof getOrganizationContext>>);
  echoIds("user");
  echoIds("asset");
  echoIds("location");
  mockPrisma.consumable.findFirst.mockResolvedValue({
    consumableid: RECORD_ID,
    consumablename: "Toner",
    quantity: 10,
  } as never);
  mockPrisma.licence.findFirst.mockResolvedValue({
    licenceid: RECORD_ID,
    licencekey: "KEY",
    seatCount: 5,
  } as never);
  mockPrisma.licenceSeatAssignment.aggregate.mockResolvedValue({
    _max: { seatNumber: 0 },
  } as never);
  mockPrisma.licenceSeatAssignment.create.mockResolvedValue({
    id: "seat-1",
    user: { firstname: "A", lastname: "B", email: "a@b.c" },
  } as never);
  mockPrisma.auditCampaign.create.mockResolvedValue({
    id: RECORD_ID,
    name: "Q4",
  } as never);
  mockPrisma.auditCampaign.findFirst.mockResolvedValue({
    id: RECORD_ID,
    name: "Q4",
    status: "active",
    organizationId: CALLER_ORG,
  } as never);
});

describe("POST /api/consumable/checkout", () => {
  const body = { consumableId: RECORD_ID, userId: USER_A, quantity: 1 };

  it("rejects a user from another organization", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    const { status, body: res } = await parseResponse<{ error: string }>(
      await checkoutConsumable(post(body)),
    );

    expect(status).toBe(400);
    expect(res.error).toBe("User not found in your organization");
    expect(mockPrisma.consumable_checkouts.create).not.toHaveBeenCalled();
    expect(mockPrisma.consumable.update).not.toHaveBeenCalled();
  });

  it("checks the user inside the caller's organization, then checks out", async () => {
    const res = await checkoutConsumable(post(body));

    expect(res.status).toBe(201);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userid: { in: [USER_A] }, organizationId: CALLER_ORG },
      }),
    );
    expect(mockPrisma.consumable_checkouts.create).toHaveBeenCalled();
  });
});

describe("POST /api/licence/seats", () => {
  const body = { licenceId: RECORD_ID, userId: USER_A };

  it("rejects a user from another organization", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    const { status } = await parseResponse(await assignSeat(post(body)));

    expect(status).toBe(400);
    expect(mockPrisma.licenceSeatAssignment.create).not.toHaveBeenCalled();
  });

  it("checks the user inside the caller's organization, then assigns", async () => {
    const res = await assignSeat(post(body));

    expect(res.status).toBe(201);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userid: { in: [USER_A] }, organizationId: CALLER_ORG },
      }),
    );
    expect(mockPrisma.licenceSeatAssignment.create).toHaveBeenCalled();
  });
});

describe("POST /api/audits", () => {
  const body = { name: "Q4", auditorIds: [USER_A, USER_B] };

  it("rejects an auditor from another organization", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ userid: USER_A }] as never);

    const { status } = await parseResponse(await createAudit(post(body)));

    expect(status).toBe(400);
    expect(mockPrisma.auditCampaign.create).not.toHaveBeenCalled();
    expect(mockPrisma.auditCampaignAuditor.createMany).not.toHaveBeenCalled();
  });

  it("checks every auditor inside the caller's organization", async () => {
    const res = await createAudit(post(body));

    expect(res.status).toBe(201);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userid: { in: [USER_A, USER_B] },
          organizationId: CALLER_ORG,
        },
      }),
    );
    expect(mockPrisma.auditCampaignAuditor.createMany).toHaveBeenCalled();
  });
});

describe("POST /api/audits/[id]/scan", () => {
  const body = { assetId: ASSET_ID, locationId: LOCATION_ID };

  it("rejects an asset from another organization", async () => {
    mockPrisma.asset.findMany.mockResolvedValue([]);

    const { status } = await parseResponse(
      await scanAsset(post(body), scanContext),
    );

    expect(status).toBe(400);
    expect(mockPrisma.auditEntry.upsert).not.toHaveBeenCalled();
  });

  it("rejects a location from another organization", async () => {
    mockPrisma.location.findMany.mockResolvedValue([]);

    const { status } = await parseResponse(
      await scanAsset(post(body), scanContext),
    );

    expect(status).toBe(400);
    expect(mockPrisma.auditEntry.upsert).not.toHaveBeenCalled();
  });

  it("checks asset and location inside the caller's organization", async () => {
    const res = await scanAsset(post(body), scanContext);

    expect(res.status).toBeLessThan(300);
    expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assetid: { in: [ASSET_ID] }, organizationId: CALLER_ORG },
      }),
    );
    expect(mockPrisma.auditEntry.upsert).toHaveBeenCalled();
  });
});
