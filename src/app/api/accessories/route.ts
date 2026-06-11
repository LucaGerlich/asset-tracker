import { type NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { invalidateCacheByPrefix } from "@/lib/cache";
import { createAccessorySchema } from "@/lib/validation";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { logger, logCatchError } from "@/lib/logger";
import {
  createAuditLog,
  createAuditLogWithDiff,
  toRecord,
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
} from "@/lib/audit-log";
import { conflictResponse } from "@/lib/concurrency";

const ACCESSORY_SORT_FIELDS = ["accessoriename", "creation_date"];

const accessorySchema = createAccessorySchema
  .extend({
    purchaseprice: z.number().nonnegative().nullable().optional(),
  })
  .strict();

const updateSchema = accessorySchema.partial().strict();

const normalizeDateInput = (value: unknown) => {
  if (value === null || value === undefined) return value;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00.000Z`;
  }
  return trimmed;
};

const normalizeNumberInput = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value === "number") return value;
  const num = Number(value);
  return Number.isNaN(num) ? value : num;
};

// Pagination: ?page=1&pageSize=25&sortBy=accessoriename&sortOrder=asc&search=keyword
export async function GET(req: NextRequest) {
  try {
    await requirePermission("accessory:view");
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const searchParams = req.nextUrl.searchParams;

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const where = scopeToOrganization({}, orgId);
      const items = await prisma.accessories.findMany({
        where,
        select: {
          accessorieid: true,
          accessoriename: true,
          accessorietag: true,
          manufacturerid: true,
          statustypeid: true,
          accessoriecategorytypeid: true,
          locationid: true,
          supplierid: true,
          modelid: true,
          purchaseprice: true,
          purchasedate: true,
          requestable: true,
          creation_date: true,
          change_date: true,
        },
      });
      return NextResponse.json(items, { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, ACCESSORY_SORT_FIELDS);

    const where: Record<string, unknown> = scopeToOrganization({}, orgId);

    // Full-text search using tsvector GIN index (falls back to ILIKE if needed)
    if (params.search) {
      const tsQuery = params.search.trim().split(/\s+/).join(" & ");
      const matchingIds = await prisma
        .$queryRawUnsafe<
          Array<{ accessorieid: string }>
        >(`SELECT "accessorieid" FROM "accessories" WHERE "search_vector" @@ websearch_to_tsquery('english', $1)`, tsQuery)
        .catch(() => null);

      if (matchingIds && matchingIds.length > 0) {
        where.accessorieid = { in: matchingIds.map((r) => r.accessorieid) };
      } else if (matchingIds) {
        // tsvector returned no results — empty set
        where.accessorieid = { in: [] };
      } else {
        // Fallback to ILIKE if tsvector query failed (e.g. migration not applied yet)
        where.OR = [
          { accessoriename: { contains: params.search, mode: "insensitive" } },
          { accessorietag: { contains: params.search, mode: "insensitive" } },
        ];
      }
    }

    const [items, total] = await Promise.all([
      prisma.accessories.findMany({ where, ...prismaArgs }),
      prisma.accessories.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedResponse(items, total, params), {
      status: 200,
    });
  } catch (e) {
    logger.error("GET /api/accessories error", { error: e });
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof Error && e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch accessories" },
      { status: 500 },
    );
  }
}

// POST /api/accessories
export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    await requirePermission("accessory:create");
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;
    const body = await req.json();
    const normalized = {
      ...body,
      purchaseprice: normalizeNumberInput(body?.purchaseprice),
      purchasedate: normalizeDateInput(body?.purchasedate),
    };

    const validationResult = accessorySchema.safeParse(normalized);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues.map((i) => i.message),
        },
        { status: 400 },
      );
    }

    const {
      accessoriename,
      accessorietag,
      manufacturerid,
      statustypeid,
      accessoriecategorytypeid,
      locationid,
      supplierid,
      modelid,
      purchaseprice,
      purchasedate,
      requestable,
    } = validationResult.data;

    const created = await prisma.accessories.create({
      data: {
        accessoriename,
        accessorietag,
        manufacturerid,
        statustypeid,
        accessoriecategorytypeid,
        locationid,
        supplierid,
        modelid,
        purchaseprice: purchaseprice ?? null,
        purchasedate: purchasedate ? new Date(purchasedate) : null,
        requestable: typeof requestable === "boolean" ? requestable : null,
        organizationId: orgId || null,
        creation_date: new Date(),
      } as Prisma.accessoriesUncheckedCreateInput,
    });

    invalidateCacheByPrefix("accessories_all").catch(() => {});
    invalidateCacheByPrefix("accessory_count").catch(() => {});
    createAuditLog({
      userId: orgCtx?.userId ?? null,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.ACCESSORY,
      entityId: created.accessorieid,
      details: {
        accessoriename: created.accessoriename,
        accessorietag: created.accessorietag,
      },
    }).catch(logCatchError("Audit log failed"));
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    logger.error("POST /api/accessories error", { error: e });
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof Error && e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to create accessory" },
      { status: 500 },
    );
  }
}

// PUT /api/accessories
export async function PUT(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    await requirePermission("accessory:edit");
    const body = await req.json();
    const { accessorieid, _expectedVersion, ...data } = body || {};

    if (!accessorieid) {
      return NextResponse.json(
        { error: "accessorieid is required" },
        { status: 400 },
      );
    }

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;
    const existing = await prisma.accessories.findFirst({
      where: scopeToOrganization({ accessorieid }, orgId),
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Accessory not found" },
        { status: 404 },
      );
    }

    // Optimistic concurrency check
    const conflict = conflictResponse(_expectedVersion, existing.change_date);
    if (conflict) return conflict;

    const normalized = {
      ...data,
      purchaseprice: normalizeNumberInput(data?.purchaseprice),
      purchasedate: normalizeDateInput(data?.purchasedate),
    };

    const validationResult = updateSchema.safeParse(normalized);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues.map((i) => i.message),
        },
        { status: 400 },
      );
    }

    const updateData = { ...validationResult.data } as Record<string, unknown>;
    if (
      Object.prototype.hasOwnProperty.call(updateData, "purchasedate") &&
      updateData.purchasedate
    ) {
      updateData.purchasedate = new Date(updateData.purchasedate as string);
    }

    const updated = await prisma.accessories.update({
      where: { accessorieid: existing.accessorieid },
      data: {
        ...updateData,
        change_date: new Date(),
      },
    });

    invalidateCacheByPrefix("accessories_all").catch(() => {});
    createAuditLogWithDiff({
      userId: orgCtx?.userId ?? null,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.ACCESSORY,
      entityId: existing.accessorieid,
      before: toRecord(existing),
      after: toRecord(updated),
    }).catch(logCatchError("Audit log failed"));
    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    logger.error("PUT /api/accessories error", { error: e });
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof Error && e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to update accessory" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
