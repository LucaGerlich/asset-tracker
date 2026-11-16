import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { CREATE: "CREATE", UPDATE: "UPDATE" },
  AUDIT_ENTITIES: { ASSET: "ASSET" },
}));
vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/integrations/slack-teams", () => ({
  notifyIntegrations: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn().mockResolvedValue({
    organization: { id: "org-uuid-001" },
  }),
  scopeToOrganization: (where: object, organizationId?: string | null) => ({
    ...where,
    organizationId: organizationId ?? null,
  }),
}));

import { POST as checkout } from "@/app/api/asset/checkout/route";
import { POST as bulkCheckout } from "@/app/api/asset/checkout/bulk/route";
import { PUT as checkin } from "@/app/api/asset/checkout/[id]/route";
import prisma from "@/lib/prisma";
import { triggerWebhook } from "@/lib/webhooks";

const mockPrisma = vi.mocked(prisma, true);

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ASSET_A = uuid(1);
const ASSET_B = uuid(2);
const USER_ID = uuid(3);

const asset = (assetid: string) => ({
  assetid,
  assetname: `Asset ${assetid.slice(-2)}`,
  assettag: `T-${assetid.slice(-2)}`,
  organizationId: "org-uuid-001",
});

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.user.findFirst.mockResolvedValue({
    userid: USER_ID,
    firstname: "A",
    lastname: "B",
  } as never);
});

describe("POST /api/asset/checkout", () => {
  const post = () =>
    checkout(
      createMockRequest("/api/asset/checkout", {
        method: "POST",
        body: {
          assetId: ASSET_A,
          checkedOutToType: "user",
          checkedOutTo: USER_ID,
        },
      }),
    );

  beforeEach(() => {
    mockPrisma.asset.findFirst.mockResolvedValue(asset(ASSET_A) as never);
    mockPrisma.assetCheckout.create.mockResolvedValue({ id: "co-1" } as never);
  });

  it("returns 409 when the asset is already checked out", async () => {
    mockPrisma.assetCheckout.findFirst.mockResolvedValue({
      id: "co-0",
    } as never);
    const res = await post();
    const { body } = await parseResponse<{ error: string }>(res);
    expect(res.status).toBe(409);
    expect(body.error).toMatch(/already checked out/);
    expect(mockPrisma.assetCheckout.create).not.toHaveBeenCalled();
    expect(triggerWebhook).not.toHaveBeenCalled();
  });

  it("looks only at active (checked_out / overdue) checkouts of this asset", async () => {
    mockPrisma.assetCheckout.findFirst.mockResolvedValue(null);
    const res = await post();
    expect(res.status).toBe(201);
    expect(mockPrisma.assetCheckout.findFirst).toHaveBeenCalledWith({
      where: { assetId: ASSET_A, status: { in: ["checked_out", "overdue"] } },
      select: { id: true },
    });
  });
});

describe("POST /api/asset/checkout/bulk", () => {
  it("reports already checked-out assets as failed and only checks out the rest", async () => {
    mockPrisma.asset.findMany.mockResolvedValue([
      asset(ASSET_A),
      asset(ASSET_B),
    ] as never);
    mockPrisma.assetCheckout.findMany.mockResolvedValue([
      { assetId: ASSET_A },
    ] as never);
    mockPrisma.assetCheckout.create.mockResolvedValue({
      id: "co-2",
      assetId: ASSET_B,
    } as never);

    const res = await bulkCheckout(
      createMockRequest("/api/asset/checkout/bulk", {
        method: "POST",
        body: {
          assetIds: [ASSET_A, ASSET_B],
          checkedOutToType: "user",
          checkedOutTo: USER_ID,
        },
      }),
    );
    const { status, body } = await parseResponse<{
      success: unknown[];
      failed: { assetId: string; reason: string }[];
    }>(res);

    expect(status).toBe(201);
    expect(body.success).toHaveLength(1);
    expect(body.failed).toEqual([
      { assetId: ASSET_A, reason: "Asset is already checked out" },
    ]);
    expect(mockPrisma.assetCheckout.create).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when every asset is already checked out", async () => {
    mockPrisma.asset.findMany.mockResolvedValue([asset(ASSET_A)] as never);
    mockPrisma.assetCheckout.findMany.mockResolvedValue([
      { assetId: ASSET_A },
    ] as never);

    const res = await bulkCheckout(
      createMockRequest("/api/asset/checkout/bulk", {
        method: "POST",
        body: {
          assetIds: [ASSET_A],
          checkedOutToType: "user",
          checkedOutTo: USER_ID,
        },
      }),
    );

    expect(res.status).toBe(409);
    expect(mockPrisma.assetCheckout.create).not.toHaveBeenCalled();
  });
});

describe("PUT /api/asset/checkout/[id] check-in", () => {
  const put = () =>
    checkin(createMockRequest("/api/asset/checkout/co-1", { method: "PUT" }), {
      params: Promise.resolve({ id: "co-1" }),
    });

  const stored = (status: string) => ({
    id: "co-1",
    assetId: ASSET_A,
    status,
    checkedOutToType: "user",
    asset: asset(ASSET_A),
  });

  it("refuses a second check-in without touching returnDate or the webhook", async () => {
    mockPrisma.assetCheckout.findUnique.mockResolvedValue(
      stored("returned") as never,
    );
    const res = await put();
    expect(res.status).toBe(409);
    expect(mockPrisma.assetCheckout.update).not.toHaveBeenCalled();
    expect(triggerWebhook).not.toHaveBeenCalled();
  });

  it("only updates a checkout that is still active", async () => {
    mockPrisma.assetCheckout.findUnique.mockResolvedValue(
      stored("checked_out") as never,
    );
    mockPrisma.assetCheckout.update.mockResolvedValue({ id: "co-1" } as never);
    const res = await put();
    expect(res.status).toBe(200);
    expect(mockPrisma.assetCheckout.update).toHaveBeenCalledWith({
      where: { id: "co-1", status: { in: ["checked_out", "overdue"] } },
      data: { returnDate: expect.any(Date), status: "returned" },
    });
  });

  it("returns 409 when a concurrent check-in wins the race", async () => {
    mockPrisma.assetCheckout.findUnique.mockResolvedValue(
      stored("checked_out") as never,
    );
    mockPrisma.assetCheckout.update.mockRejectedValue(
      Object.assign(new Error("Record not found"), { code: "P2025" }),
    );
    const res = await put();
    expect(res.status).toBe(409);
    expect(triggerWebhook).not.toHaveBeenCalled();
  });
});
