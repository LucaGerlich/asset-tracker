import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { CREATE: "CREATE" },
  AUDIT_ENTITIES: { KIT: "KIT" },
}));
vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/integrations/slack-teams", () => ({
  notifyIntegrations: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/cache", () => ({
  invalidateCacheByPrefix: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/kits/[id]/checkout/route";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/api-auth";

const mockPrisma = vi.mocked(prisma, true);

const KIT_ID = "00000000-0000-4000-8000-000000000003";
const USER_ID = "00000000-0000-4000-8000-000000000002";
const CATEGORY_ID = "00000000-0000-4000-8000-000000000004";

const post = () =>
  POST(
    createMockRequest(`/api/kits/${KIT_ID}/checkout`, {
      method: "POST",
      body: { userId: USER_ID },
    }) as never,
    { params: Promise.resolve({ id: KIT_ID }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue({
    id: "admin-1",
    isAdmin: true,
    organizationId: "org-1",
    orgStatus: "active",
  } as never);
  mockPrisma.kit.findFirst.mockResolvedValue({
    id: KIT_ID,
    name: "Starter",
    isActive: true,
    items: [{ entityType: "asset_category", entityId: CATEGORY_ID }],
  } as never);
  mockPrisma.user.findFirst.mockResolvedValue({
    userid: USER_ID,
    firstname: "A",
    lastname: "B",
  } as never);
  mockPrisma.asset.findFirst.mockResolvedValue({
    assetid: "asset-1",
    assetname: "Laptop",
  } as never);
});

describe("POST /api/kits/[id]/checkout asset categories", () => {
  it("treats overdue checkouts as still out when picking an asset", async () => {
    await post();

    const where = mockPrisma.asset.findFirst.mock.calls[0][0]?.where;
    expect(where?.checkouts).toEqual({
      none: { status: { in: ["checked_out", "overdue"] } },
    });
  });

  it("runs the transaction Serializable", async () => {
    await post();

    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it.each(["P2034", "P2002"])("answers 409 on a %s conflict", async (code) => {
    mockPrisma.assetCheckout.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("conflict", {
        code,
        clientVersion: "test",
      }),
    );

    const res = await post();
    const { body } = await parseResponse<{ error: string }>(res);

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/retry/i);
  });
});
