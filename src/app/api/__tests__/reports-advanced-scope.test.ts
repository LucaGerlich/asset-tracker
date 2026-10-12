import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseResponse } from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn(),
  scopeToOrganization: (where: object, organizationId?: string | null) => ({
    ...where,
    organizationId: organizationId ?? null,
  }),
}));

import { GET } from "@/app/api/reports/advanced/route";
import prisma from "@/lib/prisma";
import { getOrganizationContext } from "@/lib/organization-context";

const mockPrisma = vi.mocked(prisma, true);

const OWN_ORG = "org-a";
const OTHER_ORG = "org-b";

interface AssetRow {
  assetid: string;
  purchaseprice: number;
  purchasedate: Date;
  organizationId: string;
}

// Bought today, so the depreciated value equals the purchase price.
const today = new Date();
const assets: AssetRow[] = [
  {
    assetid: "own-asset",
    purchaseprice: 1000,
    purchasedate: today,
    organizationId: OWN_ORG,
  },
  {
    assetid: "foreign-asset",
    purchaseprice: 5000,
    purchasedate: today,
    organizationId: OTHER_ORG,
  },
];

// Both organizations configured depreciation for a category; a stray foreign
// asset also sits in the caller's category (the included assets must be
// filtered as well, not only the categories).
const settings = [
  {
    id: "dep-own",
    usefulLifeYears: 5,
    salvagePercent: 10,
    organizationId: OWN_ORG,
    assets: [assets[0], assets[1]],
  },
  {
    id: "dep-foreign",
    usefulLifeYears: 5,
    salvagePercent: 10,
    organizationId: OTHER_ORG,
    assets: [assets[1]],
  },
];

interface DepreciationArgs {
  where?: { assetCategoryType?: { organizationId?: string | null } };
  include: {
    assetCategoryType: {
      include: { asset: { where?: { organizationId?: string | null } } };
    };
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOrganizationContext).mockResolvedValue({
    organization: { id: OWN_ORG },
  } as never);

  // In-memory stand-in with Prisma semantics: a filter that is missing or
  // `undefined` matches every row.
  mockPrisma.depreciation_settings.findMany.mockImplementation((async (
    args: DepreciationArgs,
  ) => {
    const categoryOrg = args.where?.assetCategoryType?.organizationId;
    const assetOrg =
      args.include.assetCategoryType.include.asset.where?.organizationId;
    return settings
      .filter(
        (s) => categoryOrg === undefined || s.organizationId === categoryOrg,
      )
      .map((s) => ({
        usefulLifeYears: s.usefulLifeYears,
        salvagePercent: s.salvagePercent,
        assetCategoryType: {
          asset: s.assets.filter(
            (a) => assetOrg === undefined || a.organizationId === assetOrg,
          ),
        },
      }));
  }) as never);
});

describe("GET /api/reports/advanced depreciation forecast", () => {
  it("sums only the caller's organization's assets", async () => {
    const { status, body } = await parseResponse<{
      depreciationForecast: { currentTotal: number };
    }>(await GET());

    expect(status).toBe(200);
    expect(body.depreciationForecast.currentTotal).toBe(1000);
  });

  it("filters both the categories and the included assets by organization", async () => {
    await GET();

    expect(mockPrisma.depreciation_settings.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assetCategoryType: { organizationId: OWN_ORG } },
        include: {
          assetCategoryType: {
            include: {
              asset: expect.objectContaining({
                where: { organizationId: OWN_ORG },
              }),
            },
          },
        },
      }),
    );
  });

  it("never reads another organization's assets for a caller without an organization", async () => {
    vi.mocked(getOrganizationContext).mockResolvedValue(null);

    const { body } = await parseResponse<{
      depreciationForecast: { currentTotal: number };
    }>(await GET());

    // Organization-less rows only: neither tenant's assets are summed.
    expect(body.depreciationForecast.currentTotal).toBe(0);
  });
});
