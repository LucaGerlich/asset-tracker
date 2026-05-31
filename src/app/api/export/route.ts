import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import {
  buildExportResponse,
  type ExportColumn,
  type ExportFormat,
} from "@/lib/export";
import {
  calculateDepreciation,
  getMethodDisplayName,
  type DepreciationMethod,
} from "@/lib/depreciation";
import {
  buildStreamingCsvResponse,
  type StreamingExportConfig,
} from "@/lib/streaming-export";
import { logger } from "@/lib/logger";

const ASSET_COLUMNS: ExportColumn[] = [
  { key: "assetname", header: "Name" },
  { key: "assettag", header: "Asset Tag" },
  { key: "serialnumber", header: "Serial Number" },
  { key: "specs", header: "Specs" },
  { key: "notes", header: "Notes" },
  { key: "purchaseprice", header: "Purchase Price" },
  { key: "purchasedate", header: "Purchase Date" },
  { key: "warrantyExpires", header: "Warranty Expires" },
  { key: "warrantyMonths", header: "Warranty Months" },
  { key: "mobile", header: "Mobile" },
  { key: "requestable", header: "Requestable" },
  { key: "creation_date", header: "Created" },
];

const USER_COLUMNS: ExportColumn[] = [
  { key: "username", header: "Username" },
  { key: "firstname", header: "First Name" },
  { key: "lastname", header: "Last Name" },
  { key: "email", header: "Email" },
  { key: "isadmin", header: "Admin" },
  { key: "canrequest", header: "Can Request" },
  { key: "creation_date", header: "Created" },
];

const LICENCE_COLUMNS: ExportColumn[] = [
  { key: "licencekey", header: "Licence Key" },
  { key: "licensedtoemail", header: "Licensed To (Email)" },
  { key: "purchaseprice", header: "Purchase Price" },
  { key: "purchasedate", header: "Purchase Date" },
  { key: "expirationdate", header: "Expiration Date" },
  { key: "notes", header: "Notes" },
  { key: "requestable", header: "Requestable" },
  { key: "creation_date", header: "Created" },
];

const ACCESSORY_COLUMNS: ExportColumn[] = [
  { key: "accessoriename", header: "Name" },
  { key: "accessorietag", header: "Tag" },
  { key: "purchaseprice", header: "Purchase Price" },
  { key: "purchasedate", header: "Purchase Date" },
  { key: "requestable", header: "Requestable" },
  { key: "creation_date", header: "Created" },
];

const DEPRECIATION_COLUMNS: ExportColumn[] = [
  { key: "assetName", header: "Asset Name" },
  { key: "assetTag", header: "Asset Tag" },
  { key: "serialNumber", header: "Serial Number" },
  { key: "category", header: "Category" },
  { key: "purchasePrice", header: "Purchase Price" },
  { key: "purchaseDate", header: "Purchase Date" },
  { key: "depreciationMethod", header: "Depreciation Method" },
  { key: "usefulLifeYears", header: "Useful Life (Years)" },
  { key: "salvagePercent", header: "Salvage Value (%)" },
  { key: "salvageValue", header: "Salvage Value" },
  { key: "currentValue", header: "Current Book Value" },
  { key: "accumulatedDepreciation", header: "Accumulated Depreciation" },
  { key: "annualDepreciation", header: "Annual Depreciation" },
  { key: "percentDepreciated", header: "% Depreciated" },
  { key: "isFullyDepreciated", header: "Fully Depreciated" },
];

const CONSUMABLE_COLUMNS: ExportColumn[] = [
  { key: "consumablename", header: "Name" },
  { key: "quantity", header: "Quantity" },
  { key: "minQuantity", header: "Min Quantity" },
  { key: "purchaseprice", header: "Purchase Price" },
  { key: "purchasedate", header: "Purchase Date" },
  { key: "creation_date", header: "Created" },
];

type EntityKey =
  | "assets"
  | "users"
  | "licences"
  | "accessories"
  | "consumables"
  | "depreciation";

interface EntityConfig {
  columns: ExportColumn[];
  sheetName: string;
  /** Full fetch for XLSX (needs all data in memory) */
  fetch: (orgId?: string | null) => Promise<Record<string, unknown>[]>;
  /** Batch fetch for streaming CSV */
  fetchBatch: (
    orgId: string | null | undefined,
    params: { skip: number; take: number },
  ) => Promise<Record<string, unknown>[]>;
  /** Optional row transform (e.g., strip sensitive fields) */
  transformRow?: (row: Record<string, unknown>) => Record<string, unknown>;
}

/** Convert Prisma select results to generic records for export. */
function toExportRows<T extends Record<string, unknown>>(
  items: T[],
): Record<string, unknown>[] {
  return items;
}

const ENTITIES: Record<EntityKey, EntityConfig> = {
  assets: {
    columns: ASSET_COLUMNS,
    sheetName: "Assets",
    fetch: async (orgId) => {
      const where = scopeToOrganization({}, orgId);
      const items = await prisma.asset.findMany({
        where,
        orderBy: { creation_date: "desc" },
        select: {
          assetname: true,
          assettag: true,
          serialnumber: true,
          specs: true,
          notes: true,
          purchaseprice: true,
          purchasedate: true,
          warrantyExpires: true,
          warrantyMonths: true,
          mobile: true,
          requestable: true,
          creation_date: true,
        },
      });
      return toExportRows(items);
    },
    fetchBatch: async (orgId, { skip, take }) => {
      const where = scopeToOrganization({}, orgId);
      const items = await prisma.asset.findMany({
        where,
        orderBy: { creation_date: "desc" },
        skip,
        take,
        select: {
          assetname: true,
          assettag: true,
          serialnumber: true,
          specs: true,
          notes: true,
          purchaseprice: true,
          purchasedate: true,
          warrantyExpires: true,
          warrantyMonths: true,
          mobile: true,
          requestable: true,
          creation_date: true,
        },
      });
      return toExportRows(items);
    },
  },
  users: {
    columns: USER_COLUMNS,
    sheetName: "Users",
    fetch: async (orgId) => {
      const where = scopeToOrganization({}, orgId);
      const items = await prisma.user.findMany({
        where,
        orderBy: { lastname: "asc" },
        select: {
          username: true,
          firstname: true,
          lastname: true,
          email: true,
          isadmin: true,
          canrequest: true,
          creation_date: true,
        },
      });
      return toExportRows(items);
    },
    fetchBatch: async (orgId, { skip, take }) => {
      const where = scopeToOrganization({}, orgId);
      const items = await prisma.user.findMany({
        where,
        orderBy: { lastname: "asc" },
        skip,
        take,
        select: {
          username: true,
          firstname: true,
          lastname: true,
          email: true,
          isadmin: true,
          canrequest: true,
          creation_date: true,
        },
      });
      return toExportRows(items);
    },
  },
  licences: {
    columns: LICENCE_COLUMNS,
    sheetName: "Licences",
    fetch: async (orgId) => {
      const where = scopeToOrganization({}, orgId);
      const items = await prisma.licence.findMany({
        where,
        orderBy: { creation_date: "desc" },
        select: {
          licencekey: true,
          licensedtoemail: true,
          purchaseprice: true,
          purchasedate: true,
          expirationdate: true,
          notes: true,
          requestable: true,
          creation_date: true,
        },
      });
      return toExportRows(items);
    },
    fetchBatch: async (orgId, { skip, take }) => {
      const where = scopeToOrganization({}, orgId);
      const items = await prisma.licence.findMany({
        where,
        orderBy: { creation_date: "desc" },
        skip,
        take,
        select: {
          licencekey: true,
          licensedtoemail: true,
          purchaseprice: true,
          purchasedate: true,
          expirationdate: true,
          notes: true,
          requestable: true,
          creation_date: true,
        },
      });
      return toExportRows(items);
    },
  },
  accessories: {
    columns: ACCESSORY_COLUMNS,
    sheetName: "Accessories",
    fetch: async (orgId) => {
      const where = scopeToOrganization({}, orgId);
      const items = await prisma.accessories.findMany({
        where,
        orderBy: { creation_date: "desc" },
        select: {
          accessoriename: true,
          accessorietag: true,
          purchaseprice: true,
          purchasedate: true,
          requestable: true,
          creation_date: true,
        },
      });
      return toExportRows(items);
    },
    fetchBatch: async (orgId, { skip, take }) => {
      const where = scopeToOrganization({}, orgId);
      const items = await prisma.accessories.findMany({
        where,
        orderBy: { creation_date: "desc" },
        skip,
        take,
        select: {
          accessoriename: true,
          accessorietag: true,
          purchaseprice: true,
          purchasedate: true,
          requestable: true,
          creation_date: true,
        },
      });
      return toExportRows(items);
    },
  },
  consumables: {
    columns: CONSUMABLE_COLUMNS,
    sheetName: "Consumables",
    fetch: async (orgId) => {
      const where = scopeToOrganization({}, orgId);
      const items = await prisma.consumable.findMany({
        where,
        orderBy: { consumablename: "asc" },
        select: {
          consumablename: true,
          quantity: true,
          minQuantity: true,
          purchaseprice: true,
          purchasedate: true,
          creation_date: true,
        },
      });
      return toExportRows(items);
    },
    fetchBatch: async (orgId, { skip, take }) => {
      const where = scopeToOrganization({}, orgId);
      const items = await prisma.consumable.findMany({
        where,
        orderBy: { consumablename: "asc" },
        skip,
        take,
        select: {
          consumablename: true,
          quantity: true,
          minQuantity: true,
          purchaseprice: true,
          purchasedate: true,
          creation_date: true,
        },
      });
      return toExportRows(items);
    },
  },
  depreciation: {
    columns: DEPRECIATION_COLUMNS,
    sheetName: "Depreciation Schedule",
    fetch: async (orgId) => {
      const where = scopeToOrganization(
        { purchaseprice: { not: null } },
        orgId,
      );
      const assets = await prisma.asset.findMany({
        where,
        orderBy: { assetname: "asc" },
        select: {
          assetname: true,
          assettag: true,
          serialnumber: true,
          purchaseprice: true,
          purchasedate: true,
          creation_date: true,
          assetcategorytypeid: true,
          assetCategoryType: {
            select: { assetcategorytypename: true },
          },
        },
      });

      const depSettings = await prisma.depreciation_settings.findMany();
      const settingsMap = new Map(depSettings.map((s) => [s.categoryId, s]));

      return buildDepreciationRows(assets, settingsMap);
    },
    fetchBatch: async (orgId, { skip, take }) => {
      const where = scopeToOrganization(
        { purchaseprice: { not: null } },
        orgId,
      );

      const [assets, depSettings] = await Promise.all([
        prisma.asset.findMany({
          where,
          orderBy: { assetname: "asc" },
          skip,
          take,
          select: {
            assetname: true,
            assettag: true,
            serialnumber: true,
            purchaseprice: true,
            purchasedate: true,
            creation_date: true,
            assetcategorytypeid: true,
            assetCategoryType: {
              select: { assetcategorytypename: true },
            },
          },
        }),
        prisma.depreciation_settings.findMany(),
      ]);

      const settingsMap = new Map(depSettings.map((s) => [s.categoryId, s]));

      return buildDepreciationRows(assets, settingsMap);
    },
  },
};

interface DepreciationAsset {
  assetname: string;
  assettag: string;
  serialnumber: string;
  purchaseprice: unknown;
  purchasedate: Date | null;
  creation_date: Date;
  assetcategorytypeid: string | null;
  assetCategoryType: { assetcategorytypename: string } | null;
}

interface DepreciationSetting {
  categoryId: string;
  method: string;
  usefulLifeYears: number;
  salvagePercent: unknown;
}

function buildDepreciationRows(
  assets: DepreciationAsset[],
  settingsMap: Map<string, DepreciationSetting>,
): Record<string, unknown>[] {
  return assets.map((asset) => {
    const price = Number(asset.purchaseprice);
    const settings = asset.assetcategorytypeid
      ? settingsMap.get(asset.assetcategorytypeid)
      : null;
    const purchaseDate = asset.purchasedate ?? asset.creation_date;

    if (!settings || !price || price <= 0 || !purchaseDate) {
      return {
        assetName: asset.assetname,
        assetTag: asset.assettag,
        serialNumber: asset.serialnumber,
        category:
          asset.assetCategoryType?.assetcategorytypename ?? "Uncategorized",
        purchasePrice: price || 0,
        purchaseDate: purchaseDate
          ? new Date(purchaseDate).toISOString().split("T")[0]
          : "",
        depreciationMethod: "N/A",
        usefulLifeYears: "",
        salvagePercent: "",
        salvageValue: "",
        currentValue: price || 0,
        accumulatedDepreciation: 0,
        annualDepreciation: "",
        percentDepreciated: 0,
        isFullyDepreciated: "N/A",
      };
    }

    const result = calculateDepreciation({
      purchasePrice: price,
      purchaseDate: new Date(purchaseDate),
      method: settings.method as DepreciationMethod,
      usefulLifeYears: settings.usefulLifeYears,
      salvagePercent: Number(settings.salvagePercent),
    });

    // Annual depreciation: for straight-line all years are equal;
    // for accelerated methods use year-1 rate as the representative value
    const annualDep = result.depreciationPerYear[0] ?? 0;

    return {
      assetName: asset.assetname,
      assetTag: asset.assettag,
      serialNumber: asset.serialnumber,
      category:
        asset.assetCategoryType?.assetcategorytypename ?? "Uncategorized",
      purchasePrice: price,
      purchaseDate: new Date(purchaseDate).toISOString().split("T")[0],
      depreciationMethod: getMethodDisplayName(
        settings.method as DepreciationMethod,
      ),
      usefulLifeYears: settings.usefulLifeYears,
      salvagePercent: Number(settings.salvagePercent),
      salvageValue: Math.round(result.salvageValue * 100) / 100,
      currentValue: Math.round(result.currentValue * 100) / 100,
      accumulatedDepreciation:
        Math.round(result.accumulatedDepreciation * 100) / 100,
      annualDepreciation: Math.round(annualDep * 100) / 100,
      percentDepreciated: Math.round(result.percentDepreciated * 10) / 10,
      isFullyDepreciated: result.isFullyDepreciated ? "Yes" : "No",
    };
  });
}

export async function GET(req: NextRequest) {
  try {
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const searchParams = req.nextUrl.searchParams;
    const entityParam = searchParams.get("entity") as EntityKey | null;
    const formatParam = (searchParams.get("format") || "csv") as ExportFormat;

    if (!entityParam || !ENTITIES[entityParam]) {
      return NextResponse.json(
        {
          error: `Invalid entity. Must be one of: ${Object.keys(ENTITIES).join(", ")}`,
        },
        { status: 400 },
      );
    }

    if (formatParam !== "csv" && formatParam !== "xlsx") {
      return NextResponse.json(
        { error: "Invalid format. Must be csv or xlsx" },
        { status: 400 },
      );
    }

    const config = ENTITIES[entityParam];
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `${entityParam}-export-${dateStr}`;

    // Use streaming for CSV exports to handle large datasets without
    if (formatParam === "csv") {
      const streamConfig: StreamingExportConfig = {
        columns: config.columns,
        fetchBatch: (params) => config.fetchBatch(orgId, params),
        batchSize: 1000,
        transformRow: config.transformRow,
      };
      return buildStreamingCsvResponse(streamConfig, filename);
    }

    // XLSX requires all data in memory (library limitation)
    const data = await config.fetch(orgId);
    return await buildExportResponse(
      data,
      config.columns,
      formatParam,
      filename,
      config.sheetName,
    );
  } catch (error) {
    logger.error("GET /api/export error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to generate export" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
