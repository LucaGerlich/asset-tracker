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
  createAuditLog: vi.fn(),
  AUDIT_ACTIONS: { DELETE: "DELETE" },
  AUDIT_ENTITIES: {
    ASSET_CATEGORY: "asset_category",
    ACCESSORY_CATEGORY: "accessory_category",
    CONSUMABLE_CATEGORY: "consumable_category",
    LICENCE_CATEGORY: "licence_category",
  },
}));
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn(),
}));

import { DELETE as deleteAsset } from "@/app/api/assetCategory/route";
import { DELETE as deleteAccessory } from "@/app/api/accessoryCategory/route";
import { DELETE as deleteLicence } from "@/app/api/licenceCategory/route";
import { DELETE as deleteConsumable } from "@/app/api/consumableCategory/route";
import prisma from "@/lib/prisma";
import { requireApiAdmin, requireNotDemoMode } from "@/lib/api-auth";
import { ForbiddenError } from "@/lib/errors";
import { getOrganizationContext } from "@/lib/organization-context";
import { createAuditLog } from "@/lib/audit-log";
import { invalidateCacheByPrefix } from "@/lib/cache";

const mockPrisma = vi.mocked(prisma, true);

const OWN_ORG = "org-uuid-001";
const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";

type ModelKey =
  | "assetCategoryType"
  | "accessorieCategoryType"
  | "licenceCategoryType"
  | "consumableCategoryType";
type ItemKey = "asset" | "accessories" | "licence" | "consumable";

interface Case {
  name: string;
  route: string;
  handler: (req: Parameters<typeof deleteAsset>[0]) => Promise<Response>;
  model: ModelKey;
  item: ItemKey;
  idField: string;
  nameField: string;
  cachePrefix: string;
}

const cases: Case[] = [
  {
    name: "assetCategory",
    route: "/api/assetCategory",
    handler: deleteAsset,
    model: "assetCategoryType",
    item: "asset",
    idField: "assetcategorytypeid",
    nameField: "assetcategorytypename",
    cachePrefix: "categories",
  },
  {
    name: "accessoryCategory",
    route: "/api/accessoryCategory",
    handler: deleteAccessory,
    model: "accessorieCategoryType",
    item: "accessories",
    idField: "accessoriecategorytypeid",
    nameField: "accessoriecategorytypename",
    cachePrefix: "accessory_categories",
  },
  {
    name: "licenceCategory",
    route: "/api/licenceCategory",
    handler: deleteLicence,
    model: "licenceCategoryType",
    item: "licence",
    idField: "licencecategorytypeid",
    nameField: "licencecategorytypename",
    cachePrefix: "licence_categories",
  },
  {
    name: "consumableCategory",
    route: "/api/consumableCategory",
    handler: deleteConsumable,
    model: "consumableCategoryType",
    item: "consumable",
    idField: "consumablecategorytypeid",
    nameField: "consumablecategorytypename",
    cachePrefix: "consumable_categories",
  },
];

describe.each(cases)("DELETE /api/$name", (c) => {
  const call = (body: Record<string, unknown>) =>
    c.handler(createMockRequest(c.route, { method: "DELETE", body }));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrganizationContext).mockResolvedValue({
      organization: { id: OWN_ORG },
    } as Awaited<ReturnType<typeof getOrganizationContext>>);
    mockPrisma[c.model].findFirst.mockResolvedValue({
      [c.nameField]: "Laptops",
    } as never);
    mockPrisma[c.item].count.mockResolvedValue(0);
    mockPrisma[c.model].delete.mockResolvedValue({} as never);
  });

  it("deletes an unreferenced category of the caller's org", async () => {
    const { status } = await parseResponse(
      await call({ [c.idField]: CATEGORY_ID }),
    );
    expect(status).toBe(200);
    expect(mockPrisma[c.model].findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { [c.idField]: CATEGORY_ID, organizationId: OWN_ORG },
      }),
    );
    expect(mockPrisma[c.model].delete).toHaveBeenCalledWith({
      where: { [c.idField]: CATEGORY_ID },
    });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "DELETE",
        entityId: CATEGORY_ID,
        details: { [c.nameField]: "Laptops" },
      }),
    );
    expect(invalidateCacheByPrefix).toHaveBeenCalledWith(c.cachePrefix);
  });

  it("returns 404 for a foreign-org or unknown category", async () => {
    mockPrisma[c.model].findFirst.mockResolvedValue(null);
    const { status } = await parseResponse(
      await call({ [c.idField]: CATEGORY_ID }),
    );
    expect(status).toBe(404);
    expect(mockPrisma[c.model].delete).not.toHaveBeenCalled();
  });

  it("returns 409 while items still reference the category", async () => {
    mockPrisma[c.item].count.mockResolvedValue(3);
    const { status, body } = await parseResponse<{ error: string }>(
      await call({ [c.idField]: CATEGORY_ID }),
    );
    expect(status).toBe(409);
    expect(body.error).toContain("3");
    expect(mockPrisma[c.model].delete).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("rejects a missing or malformed id", async () => {
    expect((await call({})).status).toBe(400);
    expect((await call({ [c.idField]: "nope" })).status).toBe(400);
    expect(mockPrisma[c.model].delete).not.toHaveBeenCalled();
  });

  it("returns 403 for non-admins", async () => {
    vi.mocked(requireApiAdmin).mockRejectedValueOnce(
      new ForbiddenError("not_admin", "Admin access required"),
    );
    const { status } = await parseResponse(
      await call({ [c.idField]: CATEGORY_ID }),
    );
    expect(status).toBe(403);
    expect(mockPrisma[c.model].delete).not.toHaveBeenCalled();
  });

  it("is blocked in demo mode", async () => {
    vi.mocked(requireNotDemoMode).mockReturnValueOnce(
      new Response(null, { status: 403 }) as never,
    );
    const res = await call({ [c.idField]: CATEGORY_ID });
    expect(res.status).toBe(403);
    expect(mockPrisma[c.model].delete).not.toHaveBeenCalled();
  });
});
