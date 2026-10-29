import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

/**
 * Cross-tenant leftovers from the 0.15.1 referenced-id sweep (TECHNICAL_DEBT
 * items 85, 87 and 88): a reservation must not reach another tenant's asset,
 * a new default status must not clear other tenants' defaults, and CSV-imported
 * locations must belong to the importing organization. Item 86 (audit-log
 * revert) lives in audit-log-revert-scope.test.ts.
 */

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");

vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn().mockResolvedValue({
    organization: { id: "org-uuid-001" },
  }),
}));
vi.mock("@/lib/cache", () => ({
  cached: vi.fn((_key: string, fn: () => unknown) => fn()),
  invalidateCacheByPrefix: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { CREATE: "create", UPDATE: "update", REQUEST: "request" },
  AUDIT_ENTITIES: { STATUS_TYPE: "status_type" },
}));
vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/integrations/slack-teams", () => ({
  notifyIntegrations: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/tenant-limits", () => ({
  checkUserLimit: vi.fn().mockResolvedValue({ allowed: true, max: -1 }),
  checkAssetLimit: vi.fn().mockResolvedValue({ allowed: true, max: -1 }),
}));

import {
  GET as reserveList,
  POST as reserve,
} from "@/app/api/reservations/route";
import {
  POST as createStatus,
  PUT as updateStatus,
} from "@/app/api/statusType/route";
import { POST as importCsv } from "@/app/api/import/route";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, true);

const CALLER_ORG = "org-uuid-001";
const ASSET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STATUS_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/reservations (item 85, read side)", () => {
  it("lists only reservations of the caller's organization", async () => {
    await reserveList(createMockRequest("/api/reservations"));
    await reserveList(createMockRequest("/api/reservations?page=1"));

    const scoped = expect.objectContaining({
      asset: { organizationId: CALLER_ORG },
    });
    expect(mockPrisma.assetReservation.findMany).toHaveBeenCalledTimes(2);
    for (const [args] of mockPrisma.assetReservation.findMany.mock.calls) {
      expect(args?.where).toEqual(scoped);
    }
    expect(mockPrisma.assetReservation.count).toHaveBeenCalledWith({
      where: scoped,
    });
  });
});

describe("POST /api/reservations (item 85)", () => {
  const reserveAsset = () =>
    reserve(
      createMockRequest("/api/reservations", {
        method: "POST",
        body: {
          assetId: ASSET_ID,
          startDate: "2026-11-02T09:00:00.000Z",
          endDate: "2026-11-03T09:00:00.000Z",
        },
      }),
    );

  it("answers 404 for an asset outside the caller's organization", async () => {
    mockPrisma.asset.findFirst.mockResolvedValue(null);

    const { status } = await parseResponse(await reserveAsset());

    expect(status).toBe(404);
    expect(mockPrisma.asset.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assetid: ASSET_ID, organizationId: CALLER_ORG },
      }),
    );
    expect(mockPrisma.assetReservation.create).not.toHaveBeenCalled();
  });

  it("reserves an asset of the caller's organization", async () => {
    mockPrisma.asset.findFirst.mockResolvedValue({
      assetid: ASSET_ID,
      requestable: true,
      organizationId: CALLER_ORG,
    } as Awaited<ReturnType<typeof prisma.asset.findFirst>>);
    mockPrisma.assetReservation.create.mockResolvedValue({
      id: "reservation-1",
      asset: { assetname: "Laptop", assettag: "A-1" },
      user: { firstname: "Ada", lastname: "Lovelace" },
    } as unknown as Awaited<ReturnType<typeof prisma.assetReservation.create>>);

    const { status } = await parseResponse(await reserveAsset());

    expect(status).toBe(201);
  });
});

describe("/api/statusType default reset (item 87)", () => {
  it("POST clears the previous default only within the caller's organization", async () => {
    mockPrisma.statusType.create.mockResolvedValue({
      statustypeid: STATUS_ID,
      statustypename: "Ready",
    } as Awaited<ReturnType<typeof prisma.statusType.create>>);

    await createStatus(
      createMockRequest("/api/statusType", {
        method: "POST",
        body: { statustypename: "Ready", isDefault: true },
      }),
    );

    expect(mockPrisma.statusType.updateMany).toHaveBeenCalledWith({
      where: { isDefault: true, organizationId: CALLER_ORG },
      data: { isDefault: false },
    });
  });

  it("PUT clears the previous default only within the caller's organization", async () => {
    mockPrisma.statusType.findFirst.mockResolvedValue({
      statustypeid: STATUS_ID,
    } as Awaited<ReturnType<typeof prisma.statusType.findFirst>>);
    mockPrisma.statusType.update.mockResolvedValue({
      statustypeid: STATUS_ID,
      statustypename: "Ready",
    } as Awaited<ReturnType<typeof prisma.statusType.update>>);

    await updateStatus(
      createMockRequest("/api/statusType", {
        method: "PUT",
        body: {
          statustypeid: STATUS_ID,
          statustypename: "Ready",
          isDefault: true,
        },
      }),
    );

    expect(mockPrisma.statusType.updateMany).toHaveBeenCalledWith({
      where: {
        isDefault: true,
        statustypeid: { not: STATUS_ID },
        organizationId: CALLER_ORG,
      },
      data: { isDefault: false },
    });
  });
});

describe("POST /api/import locations (item 88)", () => {
  it("creates imported locations in the importing organization", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      organizationId: CALLER_ORG,
    } as never);
    mockPrisma.importJob.create.mockResolvedValue({ id: "job-1" } as never);
    mockPrisma.importJob.update.mockImplementation((async (args: {
      data: Record<string, unknown>;
    }) => ({ id: "job-1", ...args.data })) as never);

    const form = new FormData();
    form.set(
      "file",
      new File(["locationname\nBerlin"], "locations.csv", { type: "text/csv" }),
    );
    form.set("entityType", "location");
    const res = await importCsv(
      new NextRequest("http://localhost:3000/api/import", {
        method: "POST",
        body: form,
      }),
    );

    expect(res.status).toBe(201);
    expect(mockPrisma.location.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        locationname: "Berlin",
        organizationId: CALLER_ORG,
      }),
    });
  });
});
