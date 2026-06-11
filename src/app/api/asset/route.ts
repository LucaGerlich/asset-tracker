import { type NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { Prisma } from "@prisma/client";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { invalidateCacheByPrefix } from "@/lib/cache";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { parseCursorParams, cursorPaginate } from "@/lib/cursor-pagination";
import {
  validateBody,
  createAssetSchema,
  updateAssetSchema,
} from "@/lib/validation";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";
import { checkAssetLimit } from "@/lib/tenant-limits";
import { logger, logCatchError } from "@/lib/logger";
import { conflictResponse } from "@/lib/concurrency";
import {
  createAuditLog,
  createAuditLogWithDiff,
  toRecord,
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
} from "@/lib/audit-log";

const ASSET_SORT_FIELDS = [
  "assetname",
  "assettag",
  "serialnumber",
  "creation_date",
  "change_date",
  "purchaseprice",
];

// Optional query: ?id=<assetid>
// Pagination: ?page=1&pageSize=25&sortBy=assetname&sortOrder=asc&search=keyword&statusId=<id>
export async function GET(req: NextRequest) {
  try {
    await requirePermission("asset:view");
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (id) {
      const asset = await prisma.asset.findFirst({
        where: scopeToOrganization({ assetid: id }, orgId),
      });
      if (!asset) {
        return NextResponse.json(
          { error: `Asset with id ${id} not found` },
          { status: 404 },
        );
      }
      return NextResponse.json(asset, { status: 200 });
    }

    const where: Record<string, unknown> = scopeToOrganization({}, orgId);

    // Status filter
    const statusId = searchParams.get("statusId");
    if (statusId) {
      where.statustypeid = statusId;
    }

    // Full-text search using tsvector GIN index (falls back to ILIKE if needed)
    const search = searchParams.get("search") ?? undefined;
    if (search) {
      // Use PostgreSQL full-text search via the generated search_vector column
      const tsQuery = search.trim().split(/\s+/).join(" & ");
      const matchingIds = await prisma
        .$queryRawUnsafe<
          Array<{ assetid: string }>
        >(`SELECT "assetid" FROM "asset" WHERE "search_vector" @@ websearch_to_tsquery('english', $1)`, tsQuery)
        .catch(() => null);

      if (matchingIds && matchingIds.length > 0) {
        where.assetid = { in: matchingIds.map((r) => r.assetid) };
      } else if (matchingIds) {
        // tsvector returned no results — empty set
        where.assetid = { in: [] };
      } else {
        // Fallback to ILIKE if tsvector query failed (e.g. migration not applied yet)
        where.OR = [
          { assetname: { contains: search, mode: "insensitive" } },
          { assettag: { contains: search, mode: "insensitive" } },
          { serialnumber: { contains: search, mode: "insensitive" } },
        ];
      }
    }

    const cursorParams = parseCursorParams(searchParams);
    if (cursorParams) {
      const sortBy = searchParams.get("sortBy");
      const sortOrder =
        searchParams.get("sortOrder") === "desc"
          ? ("desc" as const)
          : ("asc" as const);
      const orderBy =
        sortBy && ASSET_SORT_FIELDS.includes(sortBy)
          ? { [sortBy]: sortOrder }
          : { creation_date: "desc" as const };

      const result = await cursorPaginate(prisma.asset, {
        where,
        orderBy,
        cursorField: "assetid",
        limit: cursorParams.limit,
        cursor: cursorParams.cursor,
        direction: cursorParams.direction,
      });

      return NextResponse.json(result, { status: 200 });
    }

    if (!searchParams.has("page")) {
      const assets = await prisma.asset.findMany({ where });
      return NextResponse.json(assets, { status: 200 });
    }

    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, ASSET_SORT_FIELDS);

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({ where, ...prismaArgs }),
      prisma.asset.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedResponse(assets, total, params), {
      status: 200,
    });
  } catch (error) {
    logger.error("GET /api/asset error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch assets" },
      { status: 500 },
    );
  }
}

// POST /api/asset
export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    await requirePermission("asset:create");
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const limitCheck = await checkAssetLimit();
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Asset limit reached (${limitCheck.current}/${limitCheck.max}). Upgrade your plan to add more assets.`,
        },
        { status: 403 },
      );
    }

    const body = await req.json();
    const d = validateBody(createAssetSchema, body);
    if (d instanceof NextResponse) return d;

    const created = await prisma.asset.create({
      data: {
        assetname: d.assetname,
        assettag: d.assettag,
        serialnumber: d.serialnumber,
        modelid: d.modelid ?? null,
        specs: d.specs ?? null,
        notes: d.notes ?? null,
        purchaseprice: d.purchaseprice ?? null,
        purchasedate: d.purchasedate ? new Date(d.purchasedate) : null,
        mobile: d.mobile ?? null,
        requestable: d.requestable ?? null,
        assetcategorytypeid: d.assetcategorytypeid ?? null,
        statustypeid: d.statustypeid ?? null,
        supplierid: d.supplierid ?? null,
        locationid: d.locationid ?? null,
        manufacturerid: d.manufacturerid ?? null,
        warrantyMonths: d.warrantyMonths ?? null,
        warrantyExpires: d.warrantyExpires ? new Date(d.warrantyExpires) : null,
        organizationId: orgId || null,
        creation_date: new Date(),
      } as Prisma.assetUncheckedCreateInput,
    });

    invalidateCacheByPrefix("assets_all").catch(() => {});
    invalidateCacheByPrefix("asset_count").catch(() => {});
    createAuditLog({
      userId: orgCtx?.userId ?? null,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.ASSET,
      entityId: created.assetid,
      details: { assetname: created.assetname, assettag: created.assettag },
    }).catch(logCatchError("Audit log failed"));
    triggerWebhook("asset.created", {
      assetId: created.assetid,
      assetName: created.assetname,
      assetTag: created.assettag,
    }).catch(() => {});
    notifyIntegrations("asset.created", {
      assetName: created.assetname,
      assetTag: created.assettag,
    }).catch(logCatchError("Integration notification failed"));

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    logger.error("POST /api/asset error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to create asset" },
      { status: 500 },
    );
  }
}

// PUT /api/asset
// Body must include assetid; any provided fields will be updated
export async function PUT(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    await requirePermission("asset:edit");
    const body = await req.json();
    const { _expectedVersion, ...bodyWithoutVersion } = body;
    const validated = validateBody(updateAssetSchema, bodyWithoutVersion);
    if (validated instanceof NextResponse) return validated;

    const { assetid, ...data } = validated;

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;
    const existing = await prisma.asset.findFirst({
      where: scopeToOrganization({ assetid }, orgId),
    });
    if (!existing) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Optimistic concurrency check
    const conflict = conflictResponse(_expectedVersion, existing.change_date);
    if (conflict) return conflict;

    // Normalize date types
    const updateData: Record<string, unknown> = { ...data };
    if (updateData.purchasedate) {
      updateData.purchasedate = new Date(updateData.purchasedate as string);
    }
    if (updateData.warrantyExpires) {
      updateData.warrantyExpires = new Date(
        updateData.warrantyExpires as string,
      );
    }

    const updated = await prisma.asset.update({
      where: { assetid: existing.assetid },
      data: {
        ...updateData,
        change_date: new Date(),
      },
    });

    invalidateCacheByPrefix("assets_all").catch(() => {});
    createAuditLogWithDiff({
      userId: orgCtx?.userId ?? null,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.ASSET,
      entityId: existing.assetid,
      before: toRecord(existing),
      after: toRecord(updated),
    }).catch(logCatchError("Audit log failed"));
    triggerWebhook("asset.updated", {
      assetId: updated.assetid,
      assetName: updated.assetname,
      changes: Object.keys(data),
    }).catch(() => {});
    notifyIntegrations("asset.updated", {
      assetName: updated.assetname,
      assetTag: updated.assettag,
    }).catch(logCatchError("Integration notification failed"));

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    logger.error("PUT /api/asset error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to update asset" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
