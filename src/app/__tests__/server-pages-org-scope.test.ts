import { describe, it, expect, vi, beforeEach } from "vitest";

// Automock for the Prisma client (see src/lib/__mocks__/prisma.ts).
vi.mock("@/lib/prisma");

// notFound() throws in Next.js; mirror that so control flow stops like it does.
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

import prisma from "@/lib/prisma";
import { getReportData } from "@/app/reports/data";
import { getAdminUsers, getTickets } from "@/app/admin/tickets/data";
import {
  getCustomFields,
  getDepreciationSettings,
  getStatusTypes,
  getUsers,
} from "@/app/admin/settings/data";
import { getReservations } from "@/app/reservations/data";
import { getUserEditOptions } from "@/app/user/[id]/edit/data";
import { loadUserSettings } from "@/app/user/[id]/settings/data";

const mockPrisma = vi.mocked(prisma, true);

const ORG_ID = "org-uuid-001";
const OTHER_USER_ID = "user-uuid-other";
const VIEWER_ID = "user-uuid-viewer";

beforeEach(() => {
  vi.clearAllMocks();
});

/** First argument of the single call a delegate method received. */
function firstArg(fn: unknown): Record<string, unknown> {
  const mock = vi.mocked(fn as (...args: unknown[]) => unknown);
  expect(mock).toHaveBeenCalledTimes(1);
  return mock.mock.calls[0][0] as Record<string, unknown>;
}

describe("reports getReportData", () => {
  it("scopes every query to the caller's organization", async () => {
    await getReportData(ORG_ID);

    const orgWhere = { where: { organizationId: ORG_ID } };
    expect(firstArg(mockPrisma.asset.findMany)).toMatchObject(orgWhere);
    expect(firstArg(mockPrisma.user.findMany)).toEqual(orgWhere);
    expect(firstArg(mockPrisma.accessories.findMany)).toEqual(orgWhere);
    expect(firstArg(mockPrisma.licence.findMany)).toEqual(orgWhere);
    expect(firstArg(mockPrisma.consumable.findMany)).toEqual(orgWhere);
    expect(firstArg(mockPrisma.assetCategoryType.findMany)).toEqual(orgWhere);
    expect(firstArg(mockPrisma.statusType.findMany)).toEqual(orgWhere);
    expect(firstArg(mockPrisma.location.findMany)).toEqual(orgWhere);
    expect(firstArg(mockPrisma.manufacturer.findMany)).toEqual(orgWhere);
  });

  it("scopes the join tables through their parent", async () => {
    await getReportData(ORG_ID);

    // userAssets has no organizationId column: scope via the asset.
    expect(firstArg(mockPrisma.userAssets.findMany)).toEqual({
      where: { asset: { organizationId: ORG_ID } },
    });
    // depreciation_settings hangs off the asset category.
    expect(firstArg(mockPrisma.depreciation_settings.findMany)).toEqual({
      where: { assetCategoryType: { organizationId: ORG_ID } },
    });
  });

  it("returns an empty report and runs no query without an organization", async () => {
    const report = await getReportData(null);

    for (const model of [
      mockPrisma.asset,
      mockPrisma.user,
      mockPrisma.accessories,
      mockPrisma.licence,
      mockPrisma.consumable,
      mockPrisma.userAssets,
      mockPrisma.assetCategoryType,
      mockPrisma.statusType,
      mockPrisma.location,
      mockPrisma.manufacturer,
      mockPrisma.depreciation_settings,
    ]) {
      expect(model.findMany).not.toHaveBeenCalled();
    }
    expect(report.summary).toMatchObject({
      totalAssets: 0,
      totalUsers: 0,
      totalAccessories: 0,
      totalLicenses: 0,
      totalConsumables: 0,
      totalAssetValue: 0,
    });
    expect(report.rawData.assets).toEqual([]);
    expect(report.warrantyAssets).toEqual([]);
    expect(report.depreciationAssets).toEqual([]);
  });
});

describe("admin tickets loaders", () => {
  it("getTickets filters through the creator's organization", async () => {
    await getTickets(ORG_ID);

    expect(firstArg(mockPrisma.tickets.findMany)).toMatchObject({
      where: { user_tickets_createdByTouser: { organizationId: ORG_ID } },
    });
  });

  it("getTickets returns [] without querying when there is no organization", async () => {
    await expect(getTickets(null)).resolves.toEqual([]);
    expect(mockPrisma.tickets.findMany).not.toHaveBeenCalled();
  });

  it("getAdminUsers only lists admins of the caller's organization", async () => {
    await getAdminUsers(ORG_ID);

    expect(firstArg(mockPrisma.user.findMany)).toMatchObject({
      where: { isadmin: true, organizationId: ORG_ID },
    });
  });

  it("getAdminUsers returns [] without querying when there is no organization", async () => {
    await expect(getAdminUsers(null)).resolves.toEqual([]);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe("admin settings loaders", () => {
  it("getDepreciationSettings scopes through the asset category's organization", async () => {
    await getDepreciationSettings(ORG_ID);

    expect(firstArg(mockPrisma.depreciation_settings.findMany)).toMatchObject({
      where: { assetCategoryType: { organizationId: ORG_ID } },
    });
  });

  it("getUsers and getStatusTypes filter by the organization", async () => {
    await getUsers(ORG_ID);
    await getStatusTypes(ORG_ID);

    expect(firstArg(mockPrisma.user.findMany)).toMatchObject({
      where: { organizationId: ORG_ID },
    });
    expect(firstArg(mockPrisma.statusType.findMany)).toMatchObject({
      where: { organizationId: ORG_ID },
    });
  });

  it("an admin without an organization sees nothing and no query runs", async () => {
    await expect(getUsers(null)).resolves.toEqual([]);
    await expect(getStatusTypes(null)).resolves.toEqual([]);
    await expect(getCustomFields(null)).resolves.toEqual([]);
    await expect(getDepreciationSettings(null)).resolves.toEqual([]);

    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.statusType.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.custom_field_definitions.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.depreciation_settings.findMany).not.toHaveBeenCalled();
  });
});

describe("reservations getReservations", () => {
  it("scopes an admin to reservations on their organization's assets", async () => {
    await getReservations({
      userId: VIEWER_ID,
      isAdmin: true,
      organizationId: ORG_ID,
    });

    expect(firstArg(mockPrisma.assetReservation.findMany)).toMatchObject({
      where: {
        asset: { organizationId: ORG_ID },
        status: { notIn: ["cancelled", "rejected"] },
      },
    });
  });

  it("keeps a non-admin on their own reservations", async () => {
    await getReservations({
      userId: VIEWER_ID,
      isAdmin: false,
      organizationId: ORG_ID,
    });

    const where = firstArg(mockPrisma.assetReservation.findMany)
      .where as Record<string, unknown>;
    expect(where).toMatchObject({ userId: VIEWER_ID });
    expect(where).not.toHaveProperty("asset");
  });

  it("returns [] for an admin without an organization instead of listing every tenant", async () => {
    await expect(
      getReservations({
        userId: VIEWER_ID,
        isAdmin: true,
        organizationId: null,
      }),
    ).resolves.toEqual([]);
    expect(mockPrisma.assetReservation.findMany).not.toHaveBeenCalled();
  });
});

describe("user edit form options", () => {
  it("lists the organization's roles plus built-in ones, and its departments only", async () => {
    await getUserEditOptions(ORG_ID, OTHER_USER_ID);

    expect(firstArg(mockPrisma.role.findMany)).toMatchObject({
      where: { OR: [{ organizationId: ORG_ID }, { organizationId: null }] },
    });
    expect(firstArg(mockPrisma.department.findMany)).toMatchObject({
      where: { organizationId: ORG_ID },
    });
    expect(firstArg(mockPrisma.userRole.findMany)).toMatchObject({
      where: { userId: OTHER_USER_ID },
    });
  });

  it("returns no options and runs no query without an organization", async () => {
    await expect(getUserEditOptions(null, OTHER_USER_ID)).resolves.toEqual({
      allRoles: [],
      userRoles: [],
      departments: [],
    });
    expect(mockPrisma.role.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.department.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.userRole.findMany).not.toHaveBeenCalled();
  });
});

describe("user settings loadUserSettings", () => {
  const selfRow = {
    userid: VIEWER_ID,
    firstname: "Sam",
    lastname: "Self",
    email: "sam@example.com",
    twoFactorEnabled: false,
    authProvider: "local",
  };

  it("loads the viewer's own settings and preferences", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(selfRow as never);

    const { user, preferences } = await loadUserSettings(
      { id: VIEWER_ID, organizationId: ORG_ID },
      VIEWER_ID,
    );

    expect(user.userid).toBe(VIEWER_ID);
    expect(preferences.locale).toBe("en");
    expect(firstArg(mockPrisma.user.findFirst)).toMatchObject({
      where: { userid: VIEWER_ID },
    });
    expect(firstArg(mockPrisma.user_preferences.findUnique)).toEqual({
      where: { userId: VIEWER_ID },
    });
  });

  it("returns stored preferences when the user has some", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(selfRow as never);
    mockPrisma.user_preferences.findUnique.mockResolvedValue({
      theme: "dark",
      locale: "de",
      timezone: "Europe/Berlin",
      currency: "EUR",
      dateFormat: "DD.MM.YYYY",
      numberFormat: "1.234,56",
      pageSize: 50,
    } as never);

    const { preferences } = await loadUserSettings(
      { id: VIEWER_ID, organizationId: ORG_ID },
      VIEWER_ID,
    );

    expect(preferences).toEqual({
      theme: "dark",
      locale: "de",
      timezone: "Europe/Berlin",
      currency: "EUR",
      dateFormat: "DD.MM.YYYY",
      numberFormat: "1.234,56",
      pageSize: 50,
    });
  });

  it("resolves another user inside the viewer's organization only", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      ...selfRow,
      userid: OTHER_USER_ID,
    } as never);

    await loadUserSettings(
      { id: VIEWER_ID, organizationId: ORG_ID },
      OTHER_USER_ID,
    );

    expect(firstArg(mockPrisma.user.findFirst)).toMatchObject({
      where: { userid: OTHER_USER_ID, organizationId: ORG_ID },
    });
    expect(firstArg(mockPrisma.user_preferences.findUnique)).toEqual({
      where: { userId: OTHER_USER_ID },
    });
  });

  it("answers notFound for a user of another organization without reading their preferences", async () => {
    // The org-scoped lookup finds nothing for a foreign user's id.
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(
      loadUserSettings(
        { id: VIEWER_ID, organizationId: ORG_ID },
        OTHER_USER_ID,
      ),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockPrisma.user_preferences.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("refuses to look up anyone else when the viewer has no organization", async () => {
    await expect(
      loadUserSettings({ id: VIEWER_ID, organizationId: null }, OTHER_USER_ID),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.user_preferences.findUnique).not.toHaveBeenCalled();
  });

  it("still lets an organization-less viewer open their own settings", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(selfRow as never);

    await expect(
      loadUserSettings({ id: VIEWER_ID, organizationId: null }, VIEWER_ID),
    ).resolves.toMatchObject({ user: { userid: VIEWER_ID } });
  });
});
