import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

// Every write below changes data that a cached list in src/lib/data.ts serves
// (keys: user_assets_all, user_accessoires_all, consumables_all,
// audit_campaigns_all, kits_all). The writes must bust those keys.

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/cache", () => ({
  invalidateCacheByPrefix: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: {
    CREATE: "CREATE",
    UPDATE: "UPDATE",
    DELETE: "DELETE",
    APPROVE: "APPROVE",
    REJECT: "REJECT",
  },
  AUDIT_ENTITIES: { KIT: "KIT", AUDIT_CAMPAIGN: "AUDIT_CAMPAIGN" },
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
  verifyEntityOrgOwnership: vi.fn().mockResolvedValue(true),
}));

import { POST as assignAsset } from "@/app/api/userAssets/assign/route";
import { DELETE as unassignAsset } from "@/app/api/userAssets/unassign/route";
import { PUT as updateUserAsset } from "@/app/api/userAssets/update/route";
import { POST as assignAccessory } from "@/app/api/userAccessoires/assign/route";
import { DELETE as unassignAccessory } from "@/app/api/userAccessoires/unassign/route";
import { POST as checkoutKit } from "@/app/api/kits/[id]/checkout/route";
import {
  PUT as updateKit,
  DELETE as deleteKit,
} from "@/app/api/kits/[id]/route";
import { POST as activateAudit } from "@/app/api/audits/[id]/activate/route";
import { POST as completeAudit } from "@/app/api/audits/[id]/complete/route";
import { PUT as decideRequest } from "@/app/api/requests/route";
import prisma from "@/lib/prisma";
import { invalidateCacheByPrefix } from "@/lib/cache";

const mockPrisma = vi.mocked(prisma, true);
const invalidated = () =>
  vi.mocked(invalidateCacheByPrefix).mock.calls.map(([prefix]) => prefix);

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ID = uuid(1);
const USER = uuid(2);
const params = { params: Promise.resolve({ id: ID }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.asset.findFirst.mockResolvedValue({ assetid: ID } as never);
  mockPrisma.user.findFirst.mockResolvedValue({ userid: USER } as never);
  mockPrisma.accessories.findFirst.mockResolvedValue({
    accessorieid: ID,
  } as never);
  mockPrisma.statusType.findFirst.mockResolvedValue({
    statustypeid: "status-1",
  } as never);
});

describe("user asset / accessory assignment busts the cached lists", () => {
  it("assign asset -> user_assets_all", async () => {
    mockPrisma.userAssets.findFirst.mockResolvedValue(null);
    mockPrisma.userAssets.create.mockResolvedValue({
      userassetsid: "u",
    } as never);
    const res = await assignAsset(
      createMockRequest("/x", {
        method: "POST",
        body: { assetId: ID, userId: USER },
      }),
    );
    expect(res.status).toBe(200);
    expect(invalidated()).toContain("user_assets_all");
    // The assignment moves the asset's status, which the cached asset list holds.
    expect(invalidated()).toContain("assets_all");
  });

  it("unassign asset -> user_assets_all", async () => {
    const res = await unassignAsset(
      createMockRequest("/x", {
        method: "DELETE",
        body: { assetId: ID, userId: USER },
      }),
    );
    expect(res.status).toBe(200);
    expect(invalidated()).toContain("user_assets_all");
    expect(invalidated()).toContain("assets_all");
  });

  it("update user asset -> user_assets_all", async () => {
    mockPrisma.userAssets.findFirst.mockResolvedValue({
      userassetsid: ID,
    } as never);
    mockPrisma.userAssets.update.mockResolvedValue({
      userassetsid: ID,
    } as never);
    const res = await updateUserAsset(
      createMockRequest("/x", {
        method: "PUT",
        body: { userAssetsId: ID, userId: USER },
      }),
    );
    expect(res.status).toBe(200);
    expect(invalidated()).toContain("user_assets_all");
  });

  it("assign accessory -> user_accessoires_all", async () => {
    mockPrisma.userAccessoires.findFirst.mockResolvedValue(null);
    mockPrisma.userAccessoires.create.mockResolvedValue({} as never);
    const res = await assignAccessory(
      createMockRequest("/x", {
        method: "POST",
        body: { accessorieId: ID, userId: USER },
      }),
    );
    expect(res.status).toBe(200);
    expect(invalidated()).toContain("user_accessoires_all");
  });

  it("unassign accessory -> user_accessoires_all", async () => {
    mockPrisma.userAccessoires.deleteMany.mockResolvedValue({ count: 1 });
    const res = await unassignAccessory(
      createMockRequest("/x", {
        method: "DELETE",
        body: { accessorieId: ID, userId: USER },
      }),
    );
    expect(res.status).toBe(200);
    expect(invalidated()).toContain("user_accessoires_all");
  });

  it("kit checkout -> user_accessoires_all", async () => {
    mockPrisma.kit.findFirst.mockResolvedValue({
      id: ID,
      name: "Kit",
      isActive: true,
      items: [{ entityType: "accessory", entityId: ID }],
    } as never);
    mockPrisma.userAccessoires.findFirst.mockResolvedValue(null);
    const res = await checkoutKit(
      createMockRequest("/x", {
        method: "POST",
        body: { userId: USER },
      }) as NextRequest,
      params,
    );
    expect(res.status).toBe(201);
    expect(invalidated()).toContain("user_accessoires_all");
  });
});

describe("request decisions bust the lists of the assigned entity", () => {
  const decide = (entityType: string, status: string, current: string) => {
    mockPrisma.itemRequest.findUnique.mockResolvedValue({
      id: "req-1",
      entityType,
      entityId: ID,
      userId: USER,
      status: current,
      quantity: 1,
      updatedAt: new Date(),
    } as never);
    mockPrisma.itemRequest.updateMany.mockResolvedValue({ count: 1 } as never);
    mockPrisma.consumable.updateMany.mockResolvedValue({ count: 1 } as never);
    return decideRequest(
      createMockRequest("/x", {
        method: "PUT",
        body: { id: "req-1", status },
      }) as NextRequest,
    );
  };

  it("approving a consumable request -> consumables_all", async () => {
    expect((await decide("consumable", "approved", "pending")).status).toBe(
      200,
    );
    expect(invalidated()).toContain("consumables_all");
  });

  it("approving an asset request -> user_assets_all", async () => {
    expect((await decide("asset", "approved", "pending")).status).toBe(200);
    expect(invalidated()).toContain("user_assets_all");
  });

  it("approving an accessory request -> user_accessoires_all", async () => {
    expect((await decide("accessory", "approved", "pending")).status).toBe(200);
    expect(invalidated()).toContain("user_accessoires_all");
  });

  it("returning an asset -> user_assets_all, an accessory -> user_accessoires_all", async () => {
    expect((await decide("asset", "returned", "approved")).status).toBe(200);
    expect(invalidated()).toContain("user_assets_all");
    vi.mocked(invalidateCacheByPrefix).mockClear();
    expect((await decide("accessory", "returned", "approved")).status).toBe(
      200,
    );
    expect(invalidated()).toContain("user_accessoires_all");
  });
});

describe("audit campaign lifecycle busts audit_campaigns_all", () => {
  it("activate", async () => {
    mockPrisma.auditCampaign.findFirst.mockResolvedValue({
      id: ID,
      status: "draft",
      scopeType: "all",
    } as never);
    mockPrisma.asset.findMany.mockResolvedValue([]);
    const res = await activateAudit(
      createMockRequest("/x", { method: "POST" }) as NextRequest,
      params,
    );
    expect(res.status).toBe(200);
    expect(invalidated()).toContain("audit_campaigns_all");
  });

  it("complete", async () => {
    mockPrisma.auditCampaign.findFirst.mockResolvedValue({
      id: ID,
      name: "Q",
      status: "active",
      organizationId: "org-uuid-001",
      entries: [{ status: "found" }],
    } as never);
    mockPrisma.auditCampaign.update.mockResolvedValue({ id: ID } as never);
    const res = await completeAudit(
      createMockRequest("/x", { method: "POST" }) as NextRequest,
      params,
    );
    expect(res.status).toBe(200);
    expect(invalidated()).toContain("audit_campaigns_all");
  });
});

describe("kit edits bust kits_all", () => {
  it("PUT", async () => {
    mockPrisma.kit.findFirst.mockResolvedValue({ id: ID } as never);
    mockPrisma.kit.update.mockResolvedValue({ id: ID } as never);
    mockPrisma.kit.findUnique.mockResolvedValue({ id: ID, name: "K" } as never);
    const res = await updateKit(
      createMockRequest("/x", {
        method: "PUT",
        body: { name: "K" },
      }) as NextRequest,
      params,
    );
    expect(res.status).toBe(200);
    expect(invalidated()).toContain("kits_all");
  });

  it("DELETE", async () => {
    mockPrisma.kit.findFirst.mockResolvedValue({ id: ID, name: "K" } as never);
    const res = await deleteKit(
      createMockRequest("/x", { method: "DELETE" }) as NextRequest,
      params,
    );
    expect(res.status).toBe(200);
    expect(invalidated()).toContain("kits_all");
  });
});
