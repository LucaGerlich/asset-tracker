import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

// The request flows move an asset to the "Pending", "Active" or "Available"
// status. A lookup by name alone could pick another tenant's status type and
// write its ID onto this tenant's asset.

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: {
    REQUEST: "REQUEST",
    APPROVE: "APPROVE",
    REJECT: "REJECT",
  },
}));
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn().mockResolvedValue({
    organization: { id: "org-uuid-001" },
  }),
  scopeToOrganization: (where: object, organizationId?: string | null) => ({
    ...where,
    organizationId: organizationId ?? null,
  }),
  verifyEntityOrgOwnership: vi.fn().mockResolvedValue(true),
}));

import {
  POST as createRequest,
  PUT as decideRequest,
} from "@/app/api/requests/route";
import { POST as selfReturn } from "@/app/api/requests/self-return/route";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";

const mockPrisma = vi.mocked(prisma, true);

const OWN_ORG = "org-uuid-001";

const admin = {
  id: "admin-uuid-001",
  isAdmin: true,
  organizationId: OWN_ORG,
  orgStatus: "active" as const,
};

const statusLookups = () =>
  mockPrisma.statusType.findFirst.mock.calls.map((call) => call[0]?.where);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireApiAuth).mockResolvedValue(admin as never);
  mockPrisma.statusType.findFirst.mockResolvedValue({
    statustypeid: "status-own",
  } as never);
  mockPrisma.itemRequest.findFirst.mockResolvedValue(null);
  mockPrisma.itemRequest.create.mockResolvedValue({ id: "req-1" } as never);
  mockPrisma.asset.update.mockResolvedValue({} as never);
});

describe("request status changes use the caller's organization's statuses", () => {
  it("POST sets the asset to the organization's Pending status", async () => {
    const res = await createRequest(
      createMockRequest("/api/requests", {
        method: "POST",
        body: { entityType: "asset", entityId: "asset-1" },
      }),
    );

    expect(res.status).toBe(201);
    expect(statusLookups()).toEqual([
      {
        statustypename: { equals: "Pending", mode: "insensitive" },
        organizationId: OWN_ORG,
      },
    ]);
    expect(mockPrisma.asset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statustypeid: "status-own" }),
      }),
    );
  });

  const decide = (status: string, existingStatus = "pending") => {
    mockPrisma.itemRequest.findUnique.mockResolvedValue({
      id: "req-1",
      entityType: "asset",
      entityId: "asset-1",
      userId: "user-1",
      status: existingStatus,
      quantity: 1,
      updatedAt: new Date(),
    } as never);
    return decideRequest(
      createMockRequest("/api/requests", {
        method: "PUT",
        body: { id: "req-1", status },
      }) as NextRequest,
    );
  };

  it("approval sets the Active status of the organization", async () => {
    const res = await decide("approved");

    expect(res.status).toBe(200);
    expect(statusLookups()).toEqual([
      {
        statustypename: { equals: "Active", mode: "insensitive" },
        organizationId: OWN_ORG,
      },
    ]);
  });

  it("rejection restores the Available status of the organization", async () => {
    await decide("rejected");

    expect(statusLookups()).toEqual([
      {
        statustypename: { equals: "Available", mode: "insensitive" },
        organizationId: OWN_ORG,
      },
    ]);
  });

  it("a confirmed return sets the Available status of the organization", async () => {
    await decide("returned", "approved");

    expect(statusLookups()).toEqual([
      {
        statustypename: { equals: "Available", mode: "insensitive" },
        organizationId: OWN_ORG,
      },
    ]);
  });

  it("a self-return sets the Available status of the organization", async () => {
    mockPrisma.asset.findFirst.mockResolvedValue({
      assetid: "asset-1",
    } as never);
    mockPrisma.userAssets.findFirst.mockResolvedValue({
      userassetsid: "ua-1",
    } as never);

    const res = await selfReturn(
      createMockRequest("/api/requests/self-return", {
        method: "POST",
        body: { entityType: "asset", entityId: "asset-1" },
      }),
    );

    expect(res.status).toBeLessThan(300);
    expect(statusLookups()).toEqual([
      {
        statustypename: { equals: "Available", mode: "insensitive" },
        organizationId: OWN_ORG,
      },
    ]);
  });
});
