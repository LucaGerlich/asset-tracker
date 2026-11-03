import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/cache", () => ({
  invalidateCacheByPrefix: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { CREATE: "CREATE", UPDATE: "UPDATE" },
  AUDIT_ENTITIES: { COMPONENT: "COMPONENT", CONSUMABLE: "CONSUMABLE" },
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

import { POST as checkoutComponent } from "@/app/api/components/checkout/route";
import { PUT as checkinComponent } from "@/app/api/components/checkout/[id]/route";
import { POST as checkoutConsumable } from "@/app/api/consumable/checkout/route";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, true);

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const COMPONENT_ID = uuid(1);
const ASSET_ID = uuid(2);
const USER_ID = uuid(3);
const CONSUMABLE_ID = uuid(4);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/components/checkout stock decrement", () => {
  const post = () =>
    checkoutComponent(
      createMockRequest("/api/components/checkout", {
        method: "POST",
        body: { componentId: COMPONENT_ID, assetId: ASSET_ID, quantity: 3 },
      }),
    );

  beforeEach(() => {
    mockPrisma.component.findFirst.mockResolvedValue({
      id: COMPONENT_ID,
      name: "RAM",
      remainingQuantity: 5,
      minQuantity: 0,
      organizationId: "org-uuid-001",
    } as never);
    mockPrisma.asset.findFirst.mockResolvedValue({
      assetid: ASSET_ID,
    } as never);
    mockPrisma.componentCheckout.create.mockResolvedValue({
      id: "co-1",
    } as never);
  });

  it("decrements with a stock guard in the update itself", async () => {
    mockPrisma.component.updateMany.mockResolvedValue({ count: 1 } as never);
    const res = await post();
    expect(res.status).toBe(201);
    expect(mockPrisma.component.updateMany).toHaveBeenCalledWith({
      where: { id: COMPONENT_ID, remainingQuantity: { gte: 3 } },
      data: { remainingQuantity: { decrement: 3 } },
    });
  });

  it("returns 409 and records no checkout when a concurrent request took the stock", async () => {
    mockPrisma.component.updateMany.mockResolvedValue({ count: 0 } as never);
    const res = await post();
    expect(res.status).toBe(409);
    expect(mockPrisma.componentCheckout.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/consumable/checkout stock decrement", () => {
  const post = () =>
    checkoutConsumable(
      createMockRequest("/api/consumable/checkout", {
        method: "POST",
        body: { consumableId: CONSUMABLE_ID, userId: USER_ID, quantity: 2 },
      }),
    );

  beforeEach(() => {
    mockPrisma.consumable.findFirst.mockResolvedValue({
      consumableid: CONSUMABLE_ID,
      consumablename: "Toner",
      quantity: 5,
      minQuantity: 0,
      organizationId: "org-uuid-001",
    } as never);
    mockPrisma.consumable_checkouts.create.mockResolvedValue({
      id: "cc-1",
    } as never);
  });

  it("decrements with a stock guard in the update itself", async () => {
    mockPrisma.consumable.updateMany.mockResolvedValue({ count: 1 } as never);
    const res = await post();
    expect(res.status).toBe(201);
    expect(mockPrisma.consumable.updateMany).toHaveBeenCalledWith({
      where: { consumableid: CONSUMABLE_ID, quantity: { gte: 2 } },
      data: { quantity: { decrement: 2 } },
    });
  });

  it("returns 409 and records no checkout when a concurrent request took the stock", async () => {
    mockPrisma.consumable.updateMany.mockResolvedValue({ count: 0 } as never);
    const res = await post();
    expect(res.status).toBe(409);
    expect(mockPrisma.consumable_checkouts.create).not.toHaveBeenCalled();
  });
});

describe("PUT /api/components/checkout/[id] double check-in", () => {
  const put = () =>
    checkinComponent(
      createMockRequest("/api/components/checkout/co-1", {
        method: "PUT",
        body: { checkoutId: uuid(9) },
      }) as never,
      { params: Promise.resolve({ id: "co-1" }) },
    );

  beforeEach(() => {
    mockPrisma.componentCheckout.findFirst.mockResolvedValue({
      id: "co-1",
      componentId: COMPONENT_ID,
      quantity: 3,
      returnedAt: null,
      component: { id: COMPONENT_ID, name: "RAM" },
    } as never);
    mockPrisma.componentCheckout.findUniqueOrThrow.mockResolvedValue({
      id: "co-1",
    } as never);
  });

  it("claims the checkout with a returnedAt: null guard before restocking", async () => {
    mockPrisma.componentCheckout.updateMany.mockResolvedValue({
      count: 1,
    } as never);
    const res = await put();
    expect(res.status).toBe(200);
    expect(mockPrisma.componentCheckout.updateMany).toHaveBeenCalledWith({
      where: { id: "co-1", returnedAt: null },
      data: { returnedAt: expect.any(Date) },
    });
    expect(mockPrisma.component.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.component.update).toHaveBeenCalledWith({
      where: { id: COMPONENT_ID },
      data: { remainingQuantity: { increment: 3 } },
    });
  });

  it("returns 409 and does not restock when the checkout was already returned concurrently", async () => {
    mockPrisma.componentCheckout.updateMany.mockResolvedValue({
      count: 0,
    } as never);
    const res = await put();
    const { body } = await parseResponse<{ error: string }>(res);
    expect(res.status).toBe(409);
    expect(body.error).toMatch(/already been returned/);
    expect(mockPrisma.component.update).not.toHaveBeenCalled();
  });
});
