import prisma from "@/lib/prisma";
import { scopeToOrganization } from "@/lib/organization-context";
import { generateCSV, generateXLSX, type ExportColumn } from "@/lib/export";
import {
  calculateDepreciation,
  getMethodDisplayName,
  type DepreciationMethod,
} from "@/lib/depreciation";

export type ReportType = "summary" | "depreciation" | "warranty" | "tco";

export interface ReportBuffer {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  filename: string;
}

const SUMMARY_COLUMNS: ExportColumn[] = [
  { key: "metric", header: "Metric" },
  { key: "value", header: "Value" },
];

const DEPRECIATION_COLUMNS: ExportColumn[] = [
  { key: "assetName", header: "Asset Name" },
  { key: "assetTag", header: "Asset Tag" },
  { key: "category", header: "Category" },
  { key: "purchasePrice", header: "Purchase Price" },
  { key: "method", header: "Method" },
  { key: "usefulLife", header: "Useful Life (Yrs)" },
  { key: "currentValue", header: "Current Value" },
  { key: "accumulatedDep", header: "Accumulated Dep." },
  { key: "percentDep", header: "% Depreciated" },
];

const WARRANTY_COLUMNS: ExportColumn[] = [
  { key: "assetName", header: "Asset Name" },
  { key: "assetTag", header: "Asset Tag" },
  { key: "category", header: "Category" },
  { key: "warrantyExpires", header: "Warranty Expires" },
  { key: "daysRemaining", header: "Days Remaining" },
  { key: "status", header: "Status" },
];

const TCO_COLUMNS: ExportColumn[] = [
  { key: "category", header: "Category" },
  { key: "assetCount", header: "Assets" },
  { key: "purchaseCost", header: "Purchase Cost" },
  { key: "maintenanceCost", header: "Maintenance Cost" },
  { key: "totalTco", header: "Total TCO" },
];

async function generateSummaryData(
  orgId: string | null | undefined,
): Promise<Record<string, unknown>[]> {
  const where = scopeToOrganization({}, orgId);

  const [assetCount, userCount, accessoryCount, licenceCount, consumableCount] =
    await Promise.all([
      prisma.asset.count({ where }),
      prisma.user.count({ where }),
      prisma.accessories.count({ where }),
      prisma.licence.count({ where }),
      prisma.consumable.count({ where }),
    ]);

  const assetValueAgg = await prisma.asset.aggregate({
    _sum: { purchaseprice: true },
    where,
  });

  return [
    { metric: "Total Assets", value: assetCount },
    { metric: "Total Users", value: userCount },
    { metric: "Total Accessories", value: accessoryCount },
    { metric: "Total Licences", value: licenceCount },
    { metric: "Total Consumables", value: consumableCount },
    {
      metric: "Total Asset Value",
      value: Number(assetValueAgg._sum.purchaseprice) || 0,
    },
  ];
}

async function generateDepreciationData(
  orgId: string | null | undefined,
): Promise<Record<string, unknown>[]> {
  const assets = await prisma.asset.findMany({
    where: scopeToOrganization({ purchaseprice: { not: null } }, orgId),
    select: {
      assetname: true,
      assettag: true,
      purchaseprice: true,
      purchasedate: true,
      creation_date: true,
      assetcategorytypeid: true,
      assetCategoryType: { select: { assetcategorytypename: true } },
    },
  });

  const depSettings = await prisma.depreciation_settings.findMany();
  const settingsMap = new Map(depSettings.map((s) => [s.categoryId, s]));

  return assets.map((asset) => {
    const price = Number(asset.purchaseprice);
    const settings = asset.assetcategorytypeid
      ? settingsMap.get(asset.assetcategorytypeid)
      : null;
    const purchaseDate = asset.purchasedate ?? asset.creation_date;

    if (!settings || !price || !purchaseDate) {
      return {
        assetName: asset.assetname,
        assetTag: asset.assettag,
        category: asset.assetCategoryType?.assetcategorytypename ?? "N/A",
        purchasePrice: price || 0,
        method: "N/A",
        usefulLife: "",
        currentValue: price || 0,
        accumulatedDep: 0,
        percentDep: 0,
      };
    }

    const result = calculateDepreciation({
      purchasePrice: price,
      purchaseDate: new Date(purchaseDate),
      method: settings.method as DepreciationMethod,
      usefulLifeYears: settings.usefulLifeYears,
      salvagePercent: Number(settings.salvagePercent),
    });

    return {
      assetName: asset.assetname,
      assetTag: asset.assettag,
      category: asset.assetCategoryType?.assetcategorytypename ?? "N/A",
      purchasePrice: price,
      method: getMethodDisplayName(settings.method as DepreciationMethod),
      usefulLife: settings.usefulLifeYears,
      currentValue: Math.round(result.currentValue * 100) / 100,
      accumulatedDep: Math.round(result.accumulatedDepreciation * 100) / 100,
      percentDep: Math.round(result.percentDepreciated * 10) / 10,
    };
  });
}

async function generateWarrantyData(
  orgId: string | null | undefined,
): Promise<Record<string, unknown>[]> {
  const assets = await prisma.asset.findMany({
    where: scopeToOrganization({ warrantyExpires: { not: null } }, orgId),
    select: {
      assetname: true,
      assettag: true,
      warrantyExpires: true,
      assetCategoryType: { select: { assetcategorytypename: true } },
    },
    orderBy: { warrantyExpires: "asc" },
  });

  const now = new Date();

  return assets.map((asset) => {
    const expires = new Date(asset.warrantyExpires!);
    const daysRemaining = Math.ceil(
      (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    const status =
      daysRemaining <= 0
        ? "Expired"
        : daysRemaining <= 30
          ? "Expiring Soon"
          : "Active";

    return {
      assetName: asset.assetname,
      assetTag: asset.assettag,
      category: asset.assetCategoryType?.assetcategorytypename ?? "N/A",
      warrantyExpires: expires.toISOString().split("T")[0],
      daysRemaining,
      status,
    };
  });
}

async function generateTcoData(
  orgId: string | null | undefined,
): Promise<Record<string, unknown>[]> {
  // Purchase costs grouped by category
  const purchaseGroups = await prisma.asset.groupBy({
    by: ["assetcategorytypeid"],
    _sum: { purchaseprice: true },
    _count: { assetid: true },
    where: scopeToOrganization({}, orgId),
  });

  // Maintenance costs
  const maintenanceLogs = await prisma.maintenance_logs.findMany({
    where: {
      actualCost: { not: null },
      maintenance_schedules: {
        asset: scopeToOrganization({}, orgId),
      },
    },
    select: {
      actualCost: true,
      maintenance_schedules: {
        select: {
          asset: { select: { assetcategorytypeid: true } },
        },
      },
    },
  });

  const maintenanceByCat = new Map<string | null, number>();
  for (const log of maintenanceLogs) {
    const catId = log.maintenance_schedules.asset.assetcategorytypeid ?? null;
    const cost = Number(log.actualCost) || 0;
    maintenanceByCat.set(catId, (maintenanceByCat.get(catId) ?? 0) + cost);
  }

  // Category names
  const categories = await prisma.assetCategoryType.findMany({
    select: { assetcategorytypeid: true, assetcategorytypename: true },
  });
  const catNameMap = new Map(
    categories.map((c) => [c.assetcategorytypeid, c.assetcategorytypename]),
  );

  return purchaseGroups.map((g) => {
    const catId = g.assetcategorytypeid;
    const purchaseCost = Number(g._sum.purchaseprice) || 0;
    const maintenanceCost = maintenanceByCat.get(catId) ?? 0;
    return {
      category: catId ? (catNameMap.get(catId) ?? "Unknown") : "Uncategorized",
      assetCount: g._count.assetid,
      purchaseCost: Math.round(purchaseCost * 100) / 100,
      maintenanceCost: Math.round(maintenanceCost * 100) / 100,
      totalTco: Math.round((purchaseCost + maintenanceCost) * 100) / 100,
    };
  });
}

const GENERATORS: Record<
  ReportType,
  {
    columns: ExportColumn[];
    fetch: (
      orgId: string | null | undefined,
    ) => Promise<Record<string, unknown>[]>;
    sheetName: string;
  }
> = {
  summary: {
    columns: SUMMARY_COLUMNS,
    fetch: generateSummaryData,
    sheetName: "Summary",
  },
  depreciation: {
    columns: DEPRECIATION_COLUMNS,
    fetch: generateDepreciationData,
    sheetName: "Depreciation",
  },
  warranty: {
    columns: WARRANTY_COLUMNS,
    fetch: generateWarrantyData,
    sheetName: "Warranty",
  },
  tco: {
    columns: TCO_COLUMNS,
    fetch: generateTcoData,
    sheetName: "TCO",
  },
};

export async function generateReportBuffer(
  reportType: ReportType,
  format: "csv" | "xlsx",
  orgId: string | null | undefined,
): Promise<ReportBuffer> {
  const generator = GENERATORS[reportType];
  if (!generator) {
    throw new Error(`Unknown report type: ${reportType}`);
  }

  const data = await generator.fetch(orgId);
  const dateStr = new Date().toISOString().split("T")[0];
  const baseName = `${reportType}-report-${dateStr}`;

  if (format === "xlsx") {
    const xlsxBuffer = await generateXLSX(
      data,
      generator.columns,
      generator.sheetName,
    );
    return {
      buffer: Buffer.from(xlsxBuffer),
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: "xlsx",
      filename: `${baseName}.xlsx`,
    };
  }

  // Default: CSV
  const csv = generateCSV(data, generator.columns);
  return {
    buffer: Buffer.from(csv, "utf-8"),
    mimeType: "text/csv",
    extension: "csv",
    filename: `${baseName}.csv`,
  };
}
