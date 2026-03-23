import { type NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { Prisma } from "@prisma/client";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { invalidateCache } from "@/lib/cache";
import {
  createConsumableSchema,
  updateConsumableSchema,
  uuidSchema,
} from "@/lib/validation";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { logger } from "@/lib/logger";

const CONSUMABLE_SORT_FIELDS = ["consumablename", "quantity", "creation_date"];

// GET /api/consumable
// Pagination: ?page=1&pageSize=25&sortBy=consumablename&sortOrder=asc&search=keyword
export async function GET(req: NextRequest) {
  try {
    // Require consumable:view permission to view consumables
    await requirePermission("consumable:view");
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const searchParams = req.nextUrl.searchParams;

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const where = scopeToOrganization({}, orgId);
      const items = await prisma.consumable.findMany({
        where,
        orderBy: { consumablename: "asc" },
      });
      return NextResponse.json(items, { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, CONSUMABLE_SORT_FIELDS);

    const where: Record<string, unknown> = scopeToOrganization({}, orgId);

    // Full-text search using tsvector GIN index (falls back to ILIKE if needed)
    if (params.search) {
      const tsQuery = params.search.trim().split(/\s+/).join(" & ");
      const matchingIds = await prisma
        .$queryRawUnsafe<
          Array<{ consumableid: string }>
        >(`SELECT "consumableid" FROM "consumable" WHERE "search_vector" @@ websearch_to_tsquery('english', $1)`, tsQuery)
        .catch(() => null);

      if (matchingIds && matchingIds.length > 0) {
        where.consumableid = { in: matchingIds.map((r) => r.consumableid) };
      } else if (matchingIds) {
        // tsvector returned no results — empty set
        where.consumableid = { in: [] };
      } else {
        // Fallback to ILIKE if tsvector query failed (e.g. migration not applied yet)
        where.consumablename = { contains: params.search, mode: "insensitive" };
      }
    }

    const [items, total] = await Promise.all([
      prisma.consumable.findMany({ where, ...prismaArgs }),
      prisma.consumable.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedResponse(items, total, params), {
      status: 200,
    });
  } catch (e) {
    logger.error("GET /api/consumable error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to fetch consumables" },
      { status: 500 },
    );
  }
}

// POST /api/consumable
export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    // Require consumable:create permission to create consumables
    const admin = await requirePermission("consumable:create");
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const body = await req.json();

    // Validate input
    const validationResult = createConsumableSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 },
      );
    }

    const {
      consumablename,
      consumablecategorytypeid,
      manufacturerid,
      supplierid,
      purchaseprice,
      purchasedate,
      minQuantity,
      quantity,
    } = validationResult.data;

    const created = await prisma.consumable.create({
      data: {
        consumablename,
        consumablecategorytypeid,
        manufacturerid,
        supplierid,
        purchaseprice: purchaseprice ?? null,
        purchasedate: purchasedate ? new Date(purchasedate) : null,
        minQuantity: minQuantity ?? 0,
        quantity: quantity ?? 0,
        organizationId: orgId || null,
        creation_date: new Date(),
      } as Prisma.consumableUncheckedCreateInput,
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.CONSUMABLE,
      entityId: created.consumableid,
      details: { consumablename },
    });

    invalidateCache("consumables_all").catch(() => {});
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    logger.error("POST /api/consumable error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create consumable" },
      { status: 500 },
    );
  }
}

// PUT /api/consumable
export async function PUT(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    // Require consumable:edit permission to update consumables
    const admin = await requirePermission("consumable:edit");

    const body = await req.json();

    // Validate consumable ID
    const idValidation = uuidSchema.safeParse(body.consumableid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid consumable ID" },
        { status: 400 },
      );
    }

    // Validate update data
    const dataValidation = updateConsumableSchema.safeParse(body);
    if (!dataValidation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: dataValidation.error.issues,
        },
        { status: 400 },
      );
    }

    const {
      consumableid,
      consumablename,
      consumablecategorytypeid,
      manufacturerid,
      supplierid,
      purchaseprice,
      purchasedate,
      minQuantity,
      quantity,
    } = body;

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;
    const existingConsumable = await prisma.consumable.findFirst({
      where: scopeToOrganization({ consumableid }, orgId),
    });
    if (!existingConsumable) {
      return NextResponse.json(
        { error: "Consumable not found" },
        { status: 404 },
      );
    }

    const updated = await prisma.consumable.update({
      where: { consumableid: existingConsumable.consumableid },
      data: {
        ...(consumablename !== undefined && { consumablename }),
        ...(consumablecategorytypeid !== undefined && {
          consumablecategorytypeid,
        }),
        ...(manufacturerid !== undefined && { manufacturerid }),
        ...(supplierid !== undefined && { supplierid }),
        ...(purchaseprice !== undefined && {
          purchaseprice: purchaseprice ?? null,
        }),
        ...(purchasedate !== undefined && {
          purchasedate: purchasedate ? new Date(purchasedate) : null,
        }),
        ...(minQuantity !== undefined && { minQuantity }),
        ...(quantity !== undefined && { quantity }),
        change_date: new Date(),
      },
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.CONSUMABLE,
      entityId: updated.consumableid,
      details: { consumablename: updated.consumablename },
    });

    invalidateCache("consumables_all").catch(() => {});
    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    logger.error("PUT /api/consumable error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Consumable not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update consumable" },
      { status: 500 },
    );
  }
}

// DELETE /api/consumable
export async function DELETE(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    // Require consumable:delete permission to delete consumables
    const admin = await requirePermission("consumable:delete");

    const body = await req.json();
    const { consumableid } = body;

    // Validate consumable ID
    const idValidation = uuidSchema.safeParse(consumableid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid consumable ID" },
        { status: 400 },
      );
    }

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    // Verify consumable belongs to user's organization
    const consumable = await prisma.consumable.findFirst({
      where: scopeToOrganization({ consumableid }, orgId),
      select: { consumablename: true, consumableid: true },
    });

    if (!consumable) {
      return NextResponse.json(
        { error: "Consumable not found" },
        { status: 404 },
      );
    }

    // Delete the consumable
    await prisma.consumable.delete({
      where: { consumableid },
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.DELETE,
      entity: AUDIT_ENTITIES.CONSUMABLE,
      entityId: consumableid,
      details: { consumablename: consumable.consumablename },
    });

    return NextResponse.json(
      { message: "Consumable deleted successfully" },
      { status: 200 },
    );
  } catch (e) {
    logger.error("DELETE /api/consumable error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Consumable not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to delete consumable" },
      { status: 500 },
    );
  }
}

// PATCH /api/consumable (restock)
export async function PATCH(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const admin = await requirePermission("consumable:edit");
    const body = await req.json();
    const { consumableid, addQuantity } = body;

    if (!consumableid || typeof addQuantity !== "number" || addQuantity <= 0) {
      return NextResponse.json(
        { error: "consumableid and positive addQuantity required" },
        { status: 400 },
      );
    }

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;
    const existingConsumable = await prisma.consumable.findFirst({
      where: scopeToOrganization({ consumableid }, orgId),
    });
    if (!existingConsumable) {
      return NextResponse.json(
        { error: "Consumable not found" },
        { status: 404 },
      );
    }

    const updated = await prisma.consumable.update({
      where: { consumableid: existingConsumable.consumableid },
      data: { quantity: { increment: addQuantity }, change_date: new Date() },
    });

    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.CONSUMABLE,
      entityId: updated.consumableid,
      details: {
        consumablename: updated.consumablename,
        restockQuantity: addQuantity,
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    logger.error("PATCH /api/consumable error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Consumable not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to restock consumable" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
