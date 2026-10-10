import prisma from "@/lib/prisma";
import { calculateDepreciation, DepreciationMethod } from "@/lib/depreciation";

/**
 * Every query is scoped to one organization. Models without an organizationId
 * column are scoped through their parent: userAssets via the asset, and
 * depreciation_settings via the asset category.
 */
async function fetchReportRows(organizationId: string) {
  const where = { organizationId };
  const [
    assets,
    userCount,
    accessories,
    licenses,
    consumables,
    userAssets,
    categories,
    statuses,
    locations,
    manufacturers,
    depreciationSettings,
  ] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: {
        assetCategoryType: true,
        statusType: true,
        location: true,
        manufacturer: true,
      },
    }),
    // The report only shows a head count: do not load user rows for it.
    prisma.user.count({ where }),
    prisma.accessories.findMany({ where }),
    prisma.licence.findMany({ where }),
    prisma.consumable.findMany({ where }),
    prisma.userAssets.findMany({ where: { asset: where } }),
    prisma.assetCategoryType.findMany({ where }),
    prisma.statusType.findMany({ where }),
    prisma.location.findMany({ where }),
    prisma.manufacturer.findMany({ where }),
    prisma.depreciation_settings.findMany({
      where: { assetCategoryType: where },
    }),
  ]);

  return {
    assets,
    userCount,
    accessories,
    licenses,
    consumables,
    userAssets,
    categories,
    statuses,
    locations,
    manufacturers,
    depreciationSettings,
  };
}

type ReportRows = Awaited<ReturnType<typeof fetchReportRows>>;

const EMPTY_ROWS: ReportRows = {
  assets: [],
  userCount: 0,
  accessories: [],
  licenses: [],
  consumables: [],
  userAssets: [],
  categories: [],
  statuses: [],
  locations: [],
  manufacturers: [],
  depreciationSettings: [],
};

/**
 * Report data for one organization. A viewer without an organization owns no
 * rows: no query runs and the report is empty, rather than falling back to an
 * unfiltered query that would cover every tenant.
 */
export async function getReportData(organizationId: string | null) {
  const {
    assets,
    userCount,
    accessories,
    licenses,
    consumables,
    userAssets,
    categories,
    statuses,
    locations,
    manufacturers,
    depreciationSettings,
  } = organizationId ? await fetchReportRows(organizationId) : EMPTY_ROWS;

  // Calculate asset value
  const totalAssetValue = assets.reduce(
    (sum, a) => sum + (a.purchaseprice ? Number(a.purchaseprice) : 0),
    0,
  );

  // Assets by status
  const assetsByStatus = statuses.map((status) => ({
    name: status.statustypename,
    value: assets.filter((a) => a.statustypeid === status.statustypeid).length,
  }));

  // Assets by category
  const assetsByCategory = categories.map((category) => ({
    name: category.assetcategorytypename,
    value: assets.filter(
      (a) => a.assetcategorytypeid === category.assetcategorytypeid,
    ).length,
  }));

  // Assets by location
  const assetsByLocation = locations.map((location) => ({
    name: location.locationname || "Unknown",
    value: assets.filter((a) => a.locationid === location.locationid).length,
  }));

  // Assets by manufacturer
  const assetsByManufacturer = manufacturers.map((manufacturer) => ({
    name: manufacturer.manufacturername,
    value: assets.filter(
      (a) => a.manufacturerid === manufacturer.manufacturerid,
    ).length,
  }));

  // Asset utilization (assigned vs unassigned)
  const assignedAssetIds = new Set(userAssets.map((ua) => ua.assetid));
  const assignedCount = assets.filter((a) =>
    assignedAssetIds.has(a.assetid),
  ).length;
  const unassignedCount = assets.length - assignedCount;

  // Monthly acquisition data (last 12 months)
  const now = new Date();
  const monthlyAcquisitions = [];
  for (let i = 11; i >= 0; i--) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const count = assets.filter((a) => {
      if (!a.purchasedate) return false;
      const purchaseDate = new Date(a.purchasedate);
      return purchaseDate >= month && purchaseDate < nextMonth;
    }).length;
    monthlyAcquisitions.push({
      month: month.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      count,
    });
  }

  // Expiring licenses (next 90 days)
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
  const expiringLicenses = licenses.filter((l) => {
    if (!l.expirationdate) return false;
    const expDate = new Date(l.expirationdate);
    return expDate > now && expDate <= ninetyDaysFromNow;
  }).length;

  // Low stock consumables
  const lowStockConsumables = consumables.filter(
    (c) => c.quantity <= c.minQuantity,
  ).length;

  const warrantyAssets = assets
    .filter((a) => a.warrantyExpires)
    .map((a) => ({
      id: a.assetid,
      name: a.assetname,
      tag: a.assettag,
      warrantyExpires: a.warrantyExpires!.toISOString(),
      warrantyMonths: a.warrantyMonths,
      status: a.statusType?.statustypename || "Unknown",
      category: a.assetCategoryType?.assetcategorytypename || "Uncategorized",
    }));

  const depreciationAssets = assets
    .filter((a) => a.purchaseprice && a.purchasedate && a.assetcategorytypeid)
    .map((a) => {
      const settings = depreciationSettings.find(
        (ds) => ds.categoryId === a.assetcategorytypeid,
      );
      if (!settings) return null;
      const result = calculateDepreciation({
        purchasePrice: Number(a.purchaseprice),
        purchaseDate: new Date(a.purchasedate!),
        usefulLifeYears: settings.usefulLifeYears,
        salvagePercent: Number(settings.salvagePercent),
        method: settings.method as DepreciationMethod,
      });
      return {
        id: a.assetid,
        name: a.assetname,
        tag: a.assettag,
        category: a.assetCategoryType?.assetcategorytypename || "Uncategorized",
        purchasePrice: Number(a.purchaseprice),
        purchaseDate: a.purchasedate!.toISOString(),
        method: settings.method as DepreciationMethod,
        usefulLifeYears: settings.usefulLifeYears,
        salvagePercent: Number(settings.salvagePercent),
        currentValue: result.currentValue,
        accumulatedDepreciation: result.accumulatedDepreciation,
        percentDepreciated: result.percentDepreciated,
        isFullyDepreciated: result.isFullyDepreciated,
      };
    })
    .filter(Boolean);

  return {
    summary: {
      totalAssets: assets.length,
      totalUsers: userCount,
      totalAccessories: accessories.length,
      totalLicenses: licenses.length,
      totalConsumables: consumables.length,
      totalAssetValue,
      assignedAssets: assignedCount,
      unassignedAssets: unassignedCount,
      expiringLicenses,
      lowStockConsumables,
    },
    charts: {
      assetsByStatus,
      assetsByCategory,
      assetsByLocation,
      assetsByManufacturer,
      monthlyAcquisitions,
      utilization: [
        { name: "Assigned", value: assignedCount },
        { name: "Unassigned", value: unassignedCount },
      ],
    },
    rawData: {
      assets: assets.map((a) => ({
        id: a.assetid,
        name: a.assetname,
        tag: a.assettag,
        serial: a.serialnumber,
        category: a.assetCategoryType?.assetcategorytypename || "N/A",
        status: a.statusType?.statustypename || "N/A",
        location: a.location?.locationname || "N/A",
        manufacturer: a.manufacturer?.manufacturername || "N/A",
        purchasePrice: a.purchaseprice ? Number(a.purchaseprice) : 0,
        purchaseDate: a.purchasedate
          ? new Date(a.purchasedate).toISOString()
          : null,
      })),
    },
    warrantyAssets,
    depreciationAssets,
  };
}
