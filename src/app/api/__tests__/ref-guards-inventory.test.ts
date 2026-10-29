import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

/**
 * Inventory write routes store manufacturer, supplier, location, model,
 * status and category ids from the request body. Each one must belong to the
 * caller's organization: a foreign id would attach this tenant's record to
 * another tenant's row, leak that row back through includes, and let the
 * other tenant's delete cascade into this tenant's data.
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
  createAuditLogWithDiff: vi.fn().mockResolvedValue(undefined),
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

vi.mock("@/lib/tenant-limits", () => ({
  checkAssetLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, current: 0, max: -1 }),
}));

vi.mock("@/lib/geocode", () => ({
  geocodeAddress: vi.fn().mockResolvedValue(null),
}));

import * as accessories from "@/app/api/accessories/route";
import * as addAsset from "@/app/api/asset/addAsset/route";
import * as asset from "@/app/api/asset/route";
import * as assetTemplates from "@/app/api/asset-templates/route";
import * as components from "@/app/api/components/route";
import * as componentById from "@/app/api/components/[id]/route";
import * as consumable from "@/app/api/consumable/route";
import * as licence from "@/app/api/licence/route";
import * as location from "@/app/api/location/route";
import prisma from "@/lib/prisma";
import { getOrganizationContext } from "@/lib/organization-context";

const mockPrisma = vi.mocked(prisma, true);
const mockOrgContext = vi.mocked(getOrganizationContext);

const CALLER_ORG = "org-uuid-001";
const RECORD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REF_ID = "11111111-1111-4111-8111-111111111111";
const PARENT_ID = "22222222-2222-4222-8222-222222222222";

const REFERENCE_DELEGATES = [
  "manufacturer",
  "supplier",
  "location",
  "model",
  "statusType",
  "assetCategoryType",
  "accessorieCategoryType",
  "consumableCategoryType",
  "licenceCategoryType",
  "componentCategory",
  "user",
] as const;

type Delegate = (typeof REFERENCE_DELEGATES)[number];
type MockFn = ReturnType<typeof vi.fn>;

// In-org: every looked-up id resolves (findMany echoes the requested ids).
function referencesResolve() {
  for (const name of REFERENCE_DELEGATES) {
    (mockPrisma[name].findMany as unknown as MockFn).mockImplementation(
      async (args: {
        where: Record<string, { in: string[] }>;
        select: Record<string, true>;
      }) => {
        const [idField] = Object.keys(args.select);
        return args.where[idField].in.map((id) => ({ [idField]: id }));
      },
    );
  }
}

const assetRefs = {
  modelid: REF_ID,
  assetcategorytypeid: REF_ID,
  statustypeid: REF_ID,
  supplierid: REF_ID,
  locationid: REF_ID,
  manufacturerid: REF_ID,
};

const accessoryRefs = {
  manufacturerid: REF_ID,
  statustypeid: REF_ID,
  accessoriecategorytypeid: REF_ID,
  locationid: REF_ID,
  supplierid: REF_ID,
  modelid: REF_ID,
};

const componentRefs = {
  categoryId: REF_ID,
  manufacturerId: REF_ID,
  supplierId: REF_ID,
  locationId: REF_ID,
};

const ctx = { params: Promise.resolve({ id: RECORD_ID }) };

interface Case {
  name: string;
  call: (req: NextRequest) => Promise<Response>;
  method: "POST" | "PUT";
  body: Record<string, unknown>;
  // The reference whose lookup is made foreign in the negative test.
  foreign: Delegate;
  write: () => MockFn;
  // Primary-entity lookup for PUT handlers.
  existing?: () => void;
}

const cases: Case[] = [
  {
    name: "POST /api/accessories",
    call: accessories.POST,
    method: "POST",
    body: { accessoriename: "Mouse", accessorietag: "ACC-1", ...accessoryRefs },
    foreign: "accessorieCategoryType",
    write: () => mockPrisma.accessories.create as unknown as MockFn,
  },
  {
    name: "PUT /api/accessories",
    call: accessories.PUT,
    method: "PUT",
    body: { accessorieid: RECORD_ID, supplierid: REF_ID },
    foreign: "supplier",
    write: () => mockPrisma.accessories.update as unknown as MockFn,
    existing: () =>
      mockPrisma.accessories.findFirst.mockResolvedValue({
        accessorieid: RECORD_ID,
        change_date: null,
      } as never),
  },
  {
    name: "POST /api/asset/addAsset",
    call: addAsset.POST,
    method: "POST",
    body: {
      assetname: "Laptop",
      assettag: "A-1",
      serialnumber: "SN-1",
      ...assetRefs,
    },
    foreign: "statusType",
    write: () => mockPrisma.asset.create as unknown as MockFn,
  },
  {
    name: "POST /api/asset",
    call: asset.POST,
    method: "POST",
    body: {
      assetname: "Laptop",
      assettag: "A-1",
      serialnumber: "SN-1",
      ...assetRefs,
    },
    foreign: "location",
    write: () => mockPrisma.asset.create as unknown as MockFn,
  },
  {
    name: "PUT /api/asset",
    call: asset.PUT,
    method: "PUT",
    body: { assetid: RECORD_ID, modelid: REF_ID },
    foreign: "model",
    write: () => mockPrisma.asset.update as unknown as MockFn,
    existing: () =>
      mockPrisma.asset.findFirst.mockResolvedValue({
        assetid: RECORD_ID,
        change_date: null,
      } as never),
  },
  {
    name: "POST /api/asset-templates",
    call: assetTemplates.POST,
    method: "POST",
    body: { name: "Standard laptop", ...assetRefs },
    foreign: "manufacturer",
    write: () => mockPrisma.assetTemplate.create as unknown as MockFn,
  },
  {
    name: "PUT /api/asset-templates",
    call: assetTemplates.PUT,
    method: "PUT",
    body: { id: RECORD_ID, assetcategorytypeid: REF_ID },
    foreign: "assetCategoryType",
    write: () => mockPrisma.assetTemplate.update as unknown as MockFn,
    existing: () =>
      mockPrisma.assetTemplate.findFirst.mockResolvedValue({
        id: RECORD_ID,
      } as never),
  },
  {
    name: "POST /api/components",
    call: components.POST,
    method: "POST",
    body: { name: "RAM", ...componentRefs },
    foreign: "componentCategory",
    write: () => mockPrisma.component.create as unknown as MockFn,
  },
  {
    name: "PUT /api/components",
    call: components.PUT,
    method: "PUT",
    body: { id: RECORD_ID, ...componentRefs },
    foreign: "componentCategory",
    write: () => mockPrisma.component.update as unknown as MockFn,
    existing: () =>
      mockPrisma.component.findFirst.mockResolvedValue({
        id: RECORD_ID,
        totalQuantity: 1,
        remainingQuantity: 1,
      } as never),
  },
  {
    name: "PUT /api/components/[id]",
    call: (req) => componentById.PUT(req, ctx),
    method: "PUT",
    body: componentRefs,
    foreign: "location",
    write: () => mockPrisma.component.update as unknown as MockFn,
    existing: () =>
      mockPrisma.component.findFirst.mockResolvedValue({
        id: RECORD_ID,
      } as never),
  },
  {
    name: "POST /api/consumable",
    call: consumable.POST,
    method: "POST",
    body: {
      consumablename: "Toner",
      consumablecategorytypeid: REF_ID,
      manufacturerid: REF_ID,
      supplierid: REF_ID,
    },
    foreign: "consumableCategoryType",
    write: () => mockPrisma.consumable.create as unknown as MockFn,
  },
  {
    name: "PUT /api/consumable",
    call: consumable.PUT,
    method: "PUT",
    body: { consumableid: RECORD_ID, manufacturerid: REF_ID },
    foreign: "manufacturer",
    write: () => mockPrisma.consumable.update as unknown as MockFn,
    existing: () =>
      mockPrisma.consumable.findFirst.mockResolvedValue({
        consumableid: RECORD_ID,
        change_date: null,
      } as never),
  },
  {
    name: "POST /api/licence",
    call: licence.POST,
    method: "POST",
    body: {
      licencecategorytypeid: REF_ID,
      manufacturerid: REF_ID,
      supplierid: REF_ID,
      licenceduserid: REF_ID,
    },
    foreign: "user",
    write: () => mockPrisma.licence.create as unknown as MockFn,
  },
  {
    name: "PUT /api/licence",
    call: licence.PUT,
    method: "PUT",
    body: { licenceid: RECORD_ID, licencecategorytypeid: REF_ID },
    foreign: "licenceCategoryType",
    write: () => mockPrisma.licence.update as unknown as MockFn,
    existing: () =>
      mockPrisma.licence.findFirst.mockResolvedValue({
        licenceid: RECORD_ID,
        change_date: null,
      } as never),
  },
  {
    name: "POST /api/location",
    call: location.POST,
    method: "POST",
    body: { locationname: "Annex", parentId: PARENT_ID },
    foreign: "location",
    write: () => mockPrisma.location.create as unknown as MockFn,
  },
  {
    name: "PUT /api/location",
    call: location.PUT,
    method: "PUT",
    body: { locationid: RECORD_ID, parentId: PARENT_ID },
    foreign: "location",
    write: () => mockPrisma.location.update as unknown as MockFn,
    existing: () =>
      mockPrisma.location.findFirst.mockResolvedValue({
        locationid: RECORD_ID,
      } as never),
  },
];

function request(c: Case) {
  return createMockRequest("/api/test", { method: c.method, body: c.body });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockOrgContext.mockResolvedValue({
    organization: { id: CALLER_ORG },
    userId: "admin-uuid-001",
  } as Awaited<ReturnType<typeof getOrganizationContext>>);
  referencesResolve();
});

describe.each(cases)("$name", (c) => {
  it("rejects a referenced id from another organization", async () => {
    c.existing?.();
    (mockPrisma[c.foreign].findMany as unknown as MockFn).mockResolvedValue([]);

    const { status, body } = await parseResponse<{ error: string }>(
      await c.call(request(c)),
    );

    expect(status).toBe(400);
    expect(body.error).toMatch(/not found in your organization/);
    expect(c.write()).not.toHaveBeenCalled();
  });

  it("writes after checking the references inside the caller's organization", async () => {
    c.existing?.();

    const res = await c.call(request(c));

    expect(res.status).toBeLessThan(300);
    expect(c.write()).toHaveBeenCalled();
    expect(mockPrisma[c.foreign].findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: CALLER_ORG }),
      }),
    );
  });
});

describe("PUT /api/location", () => {
  it("rejects a location as its own parent", async () => {
    mockPrisma.location.findFirst.mockResolvedValue({
      locationid: RECORD_ID,
    } as never);

    const res = await location.PUT(
      createMockRequest("/api/location", {
        method: "PUT",
        body: { locationid: RECORD_ID, parentId: RECORD_ID },
      }),
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.location.update).not.toHaveBeenCalled();
  });
});
