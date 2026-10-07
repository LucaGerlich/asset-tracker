import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

/**
 * Record-level organization guards on the checkout and seat-assignment
 * detail routes. The guard must fail closed: a caller without an organization
 * may only reach records that also have none, never another tenant's records.
 */

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");

vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn(),
}));

vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { UPDATE: "update", UNASSIGN: "unassign" },
  AUDIT_ENTITIES: { ASSET: "asset", LICENCE_SEAT: "licence_seat" },
}));

vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/integrations/slack-teams", () => ({
  notifyIntegrations: vi.fn().mockResolvedValue(undefined),
}));

import {
  GET as getCheckout,
  PUT as putCheckout,
} from "@/app/api/asset/checkout/[id]/route";
import {
  GET as getSeat,
  DELETE as deleteSeat,
} from "@/app/api/licence/seats/[id]/route";
import prisma from "@/lib/prisma";
import { getOrganizationContext } from "@/lib/organization-context";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";

const mockPrisma = vi.mocked(prisma, true);
const mockOrgContext = vi.mocked(getOrganizationContext);

const CALLER_ORG = "org-uuid-001";
const OTHER_ORG = "org-uuid-002";
const RECORD_ID = "record-uuid-001";

const routeContext = { params: Promise.resolve({ id: RECORD_ID }) };

function callerIn(organizationId: string | null) {
  mockOrgContext.mockResolvedValue(
    organizationId
      ? ({ organization: { id: organizationId } } as Awaited<
          ReturnType<typeof getOrganizationContext>
        >)
      : null,
  );
}

const checkoutIn = (organizationId: string | null) => ({
  id: RECORD_ID,
  assetId: "asset-uuid-001",
  checkedOutToType: "user",
  returnDate: null,
  asset: {
    assetid: "asset-uuid-001",
    assetname: "Laptop",
    assettag: "A-1",
    organizationId,
  },
});

const seatIn = (organizationId: string | null) => ({
  id: RECORD_ID,
  licenceId: "licence-uuid-001",
  userId: "user-uuid-001",
  seatNumber: 1,
  unassignedAt: null,
  user: { userid: "user-uuid-001", firstname: "Ada", lastname: "Lovelace" },
  licence: {
    licenceid: "licence-uuid-001",
    licencekey: "KEY-1",
    organizationId,
  },
});

const request = (method: string) =>
  createMockRequest(`/api/record/${RECORD_ID}`, { method });

beforeEach(() => {
  vi.clearAllMocks();
  callerIn(CALLER_ORG);
  mockPrisma.assetCheckout.update.mockResolvedValue({
    id: RECORD_ID,
  } as Awaited<ReturnType<typeof prisma.assetCheckout.update>>);
  mockPrisma.licenceSeatAssignment.update.mockResolvedValue({
    id: RECORD_ID,
  } as Awaited<ReturnType<typeof prisma.licenceSeatAssignment.update>>);
});

describe("/api/asset/checkout/[id] organization guard", () => {
  it.each([
    ["another organization's checkout", OTHER_ORG, CALLER_ORG],
    ["an organization's checkout from an org-less caller", CALLER_ORG, null],
    ["an org-less checkout from an organization's caller", null, CALLER_ORG],
  ])("GET returns 404 for %s", async (_label, recordOrg, callerOrg) => {
    callerIn(callerOrg);
    mockPrisma.assetCheckout.findUnique.mockResolvedValue(
      checkoutIn(recordOrg) as never,
    );

    const { status } = await parseResponse(
      await getCheckout(request("GET"), routeContext),
    );

    expect(status).toBe(404);
  });

  it.each([
    ["another organization's checkout", OTHER_ORG, CALLER_ORG],
    ["an organization's checkout from an org-less caller", CALLER_ORG, null],
    ["an org-less checkout from an organization's caller", null, CALLER_ORG],
  ])(
    "PUT returns 404 for %s and changes nothing",
    async (_label, recordOrg, callerOrg) => {
      callerIn(callerOrg);
      mockPrisma.assetCheckout.findUnique.mockResolvedValue(
        checkoutIn(recordOrg) as never,
      );

      const { status } = await parseResponse(
        await putCheckout(request("PUT"), routeContext),
      );

      expect(status).toBe(404);
      expect(mockPrisma.assetCheckout.update).not.toHaveBeenCalled();
      expect(triggerWebhook).not.toHaveBeenCalled();
      expect(notifyIntegrations).not.toHaveBeenCalled();
    },
  );

  it("allows the same organization and an org-less caller on an org-less record", async () => {
    mockPrisma.assetCheckout.findUnique.mockResolvedValue(
      checkoutIn(CALLER_ORG) as never,
    );
    expect((await getCheckout(request("GET"), routeContext)).status).toBe(200);

    callerIn(null);
    mockPrisma.assetCheckout.findUnique.mockResolvedValue(
      checkoutIn(null) as never,
    );
    expect((await getCheckout(request("GET"), routeContext)).status).toBe(200);
  });

  it("checks in an own-organization checkout and forwards the record's organization to the webhook", async () => {
    mockPrisma.assetCheckout.findUnique.mockResolvedValue(
      checkoutIn(CALLER_ORG) as never,
    );

    const { status } = await parseResponse(
      await putCheckout(request("PUT"), routeContext),
    );

    expect(status).toBe(200);
    expect(mockPrisma.assetCheckout.update).toHaveBeenCalledTimes(1);
    expect(vi.mocked(triggerWebhook).mock.calls[0][2]).toBe(CALLER_ORG);
  });
});

describe("/api/licence/seats/[id] organization guard", () => {
  it.each([
    ["another organization's seat", OTHER_ORG, CALLER_ORG],
    ["an organization's seat from an org-less caller", CALLER_ORG, null],
    ["an org-less seat from an organization's caller", null, CALLER_ORG],
  ])("GET returns 404 for %s", async (_label, recordOrg, callerOrg) => {
    callerIn(callerOrg);
    mockPrisma.licenceSeatAssignment.findUnique.mockResolvedValue(
      seatIn(recordOrg) as never,
    );

    const { status } = await parseResponse(
      await getSeat(request("GET"), routeContext),
    );

    expect(status).toBe(404);
  });

  it.each([
    ["another organization's seat", OTHER_ORG, CALLER_ORG],
    ["an organization's seat from an org-less caller", CALLER_ORG, null],
    ["an org-less seat from an organization's caller", null, CALLER_ORG],
  ])(
    "DELETE returns 404 for %s and changes nothing",
    async (_label, recordOrg, callerOrg) => {
      callerIn(callerOrg);
      mockPrisma.licenceSeatAssignment.findUnique.mockResolvedValue(
        seatIn(recordOrg) as never,
      );

      const { status } = await parseResponse(
        await deleteSeat(request("DELETE"), routeContext),
      );

      expect(status).toBe(404);
      expect(mockPrisma.licenceSeatAssignment.update).not.toHaveBeenCalled();
      expect(triggerWebhook).not.toHaveBeenCalled();
      expect(notifyIntegrations).not.toHaveBeenCalled();
    },
  );

  it("allows the same organization and an org-less caller on an org-less record", async () => {
    mockPrisma.licenceSeatAssignment.findUnique.mockResolvedValue(
      seatIn(CALLER_ORG) as never,
    );
    expect((await getSeat(request("GET"), routeContext)).status).toBe(200);

    callerIn(null);
    mockPrisma.licenceSeatAssignment.findUnique.mockResolvedValue(
      seatIn(null) as never,
    );
    expect((await getSeat(request("GET"), routeContext)).status).toBe(200);
  });

  it("unassigns an own-organization seat and forwards the record's organization to the webhook", async () => {
    mockPrisma.licenceSeatAssignment.findUnique.mockResolvedValue(
      seatIn(CALLER_ORG) as never,
    );

    const { status } = await parseResponse(
      await deleteSeat(request("DELETE"), routeContext),
    );

    expect(status).toBe(200);
    expect(mockPrisma.licenceSeatAssignment.update).toHaveBeenCalledTimes(1);
    expect(vi.mocked(triggerWebhook).mock.calls[0][2]).toBe(CALLER_ORG);
  });
});
