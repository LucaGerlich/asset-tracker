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
  buildStreamingCsvResponse,
  type StreamingExportConfig,
} from "@/lib/streaming-export";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Column definitions per entity
// ---------------------------------------------------------------------------

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

const CONSUMABLE_COLUMNS: ExportColumn[] = [
  { key: "consumablename", header: "Name" },
  { key: "quantity", header: "Quantity" },
  { key: "minQuantity", header: "Min Quantity" },
  { key: "purchaseprice", header: "Purchase Price" },
  { key: "purchasedate", header: "Purchase Date" },
  { key: "creation_date", header: "Created" },
];

// ---------------------------------------------------------------------------
// Entity configuration
// ---------------------------------------------------------------------------

type EntityKey =
  | "assets"
  | "users"
  | "licences"
  | "accessories"
  | "consumables";

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

function stripPassword(user: Record<string, unknown>): Record<string, unknown> {
  const { password, mfaSecret, mfaBackupCodes, ...rest } = user;
  return rest;
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
      return items as unknown as Record<string, unknown>[];
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
      return items as unknown as Record<string, unknown>[];
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
      return items as unknown as Record<string, unknown>[];
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
      return items as unknown as Record<string, unknown>[];
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
      return items as unknown as Record<string, unknown>[];
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
      return items as unknown as Record<string, unknown>[];
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
      return items as unknown as Record<string, unknown>[];
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
      return items as unknown as Record<string, unknown>[];
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
      return items as unknown as Record<string, unknown>[];
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
      return items as unknown as Record<string, unknown>[];
    },
  },
};

// ---------------------------------------------------------------------------
// GET /api/export?entity=assets&format=xlsx
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const searchParams = req.nextUrl.searchParams;
    const entityParam = searchParams.get("entity") as EntityKey | null;
    const formatParam = (searchParams.get("format") || "csv") as ExportFormat;

    // Validate entity
    if (!entityParam || !ENTITIES[entityParam]) {
      return NextResponse.json(
        {
          error: `Invalid entity. Must be one of: ${Object.keys(ENTITIES).join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Validate format
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
    // loading everything into memory at once.
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
    return buildExportResponse(
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
