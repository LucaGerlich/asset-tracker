import { type NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { Prisma } from "@prisma/client";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { invalidateCache } from "@/lib/cache";
import {
  createLicenseSchema,
  updateLicenseSchema,
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
import { triggerWebhook } from "@/lib/webhooks";

const LICENCE_SORT_FIELDS = ["licencekey", "creation_date"];

// GET /api/licence
// Pagination: ?page=1&pageSize=25&sortBy=licencekey&sortOrder=asc&search=keyword
export async function GET(req: NextRequest) {
  try {
    // Require license:view permission to view licences
    await requirePermission("license:view");
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const searchParams = req.nextUrl.searchParams;

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const where = scopeToOrganization({}, orgId);
      const items = await prisma.licence.findMany({
        where,
        orderBy: { creation_date: "desc" },
        include: {
          _count: {
            select: {
              seatAssignments: {
                where: { unassignedAt: null },
              },
            },
          },
        },
      });
      const itemsWithAvailability = items.map((item) => ({
        ...item,
        assignedSeats: item._count.seatAssignments,
        availableSeats: item.seatCount - item._count.seatAssignments,
      }));
      return NextResponse.json(itemsWithAvailability, { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, LICENCE_SORT_FIELDS);

    const where: Record<string, unknown> = scopeToOrganization({}, orgId);

    // Full-text search using tsvector GIN index (falls back to ILIKE if needed)
    if (params.search) {
      const tsQuery = params.search.trim().split(/\s+/).join(" & ");
      const matchingIds = await prisma
        .$queryRawUnsafe<
          Array<{ licenceid: string }>
        >(`SELECT "licenceid" FROM "licence" WHERE "search_vector" @@ websearch_to_tsquery('english', $1)`, tsQuery)
        .catch(() => null);

      if (matchingIds && matchingIds.length > 0) {
        where.licenceid = { in: matchingIds.map((r) => r.licenceid) };
      } else if (matchingIds) {
        // tsvector returned no results — empty set
        where.licenceid = { in: [] };
      } else {
        // Fallback to ILIKE if tsvector query failed (e.g. migration not applied yet)
        where.OR = [
          { licencekey: { contains: params.search, mode: "insensitive" } },
          { licensedtoemail: { contains: params.search, mode: "insensitive" } },
        ];
      }
    }

    const [items, total] = await Promise.all([
      prisma.licence.findMany({
        where,
        ...prismaArgs,
        include: {
          _count: {
            select: {
              seatAssignments: {
                where: { unassignedAt: null },
              },
            },
          },
        },
      }),
      prisma.licence.count({ where }),
    ]);

    const itemsWithAvailability = items.map((item) => ({
      ...item,
      assignedSeats: item._count.seatAssignments,
      availableSeats: item.seatCount - item._count.seatAssignments,
    }));

    return NextResponse.json(
      buildPaginatedResponse(itemsWithAvailability, total, params),
      { status: 200 },
    );
  } catch (e) {
    logger.error("GET /api/licence error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to fetch licences" },
      { status: 500 },
    );
  }
}

// POST /api/licence
export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    // Require license:create permission to create licences
    const admin = await requirePermission("license:create");

    const body = await req.json();

    // Validate input
    const validationResult = createLicenseSchema.safeParse(body);
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
      licencekey,
      licenceduserid,
      licensedtoemail,
      purchaseprice,
      purchasedate,
      expirationdate,
      notes,
      requestable,
      licencecategorytypeid,
      manufacturerid,
      supplierid,
    } = validationResult.data;

    // Accept seatCount from body (default 1)
    const seatCount =
      typeof body.seatCount === "number" && body.seatCount >= 1
        ? body.seatCount
        : 1;

    const created = await prisma.licence.create({
      data: {
        licencekey: licencekey ?? null,
        licenceduserid: licenceduserid ?? null,
        licensedtoemail: licensedtoemail ?? null,
        purchaseprice: purchaseprice ?? null,
        purchasedate: purchasedate ? new Date(purchasedate) : null,
        expirationdate: expirationdate ? new Date(expirationdate) : null,
        notes: notes ?? null,
        requestable: requestable ?? null,
        licencecategorytypeid,
        manufacturerid,
        supplierid,
        seatCount,
        creation_date: new Date(),
      } as Prisma.licenceUncheckedCreateInput,
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.LICENSE,
      entityId: created.licenceid,
      details: { licencekey: created.licencekey },
    });

    if (created.licenceduserid) {
      triggerWebhook("license.assigned", {
        licenceId: created.licenceid,
        userId: created.licenceduserid,
        licenceKey: created.licencekey,
      }).catch(() => {});
    }

    invalidateCache("licences_all").catch(() => {});
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    logger.error("POST /api/licence error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create licence" },
      { status: 500 },
    );
  }
}

// PUT /api/licence
export async function PUT(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    // Require license:edit permission to update licences
    const admin = await requirePermission("license:edit");

    const body = await req.json();

    // Validate licence ID
    const idValidation = uuidSchema.safeParse(body.licenceid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid licence ID" },
        { status: 400 },
      );
    }

    // Validate update data
    const dataValidation = updateLicenseSchema.safeParse(body);
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
      licenceid,
      licencekey,
      licenceduserid,
      licensedtoemail,
      purchaseprice,
      purchasedate,
      expirationdate,
      notes,
      requestable,
      licencecategorytypeid,
      manufacturerid,
      supplierid,
      seatCount,
    } = body;

    const updated = await prisma.licence.update({
      where: { licenceid },
      data: {
        ...(licencekey !== undefined && { licencekey: licencekey ?? null }),
        ...(licenceduserid !== undefined && {
          licenceduserid: licenceduserid ?? null,
        }),
        ...(licensedtoemail !== undefined && {
          licensedtoemail: licensedtoemail ?? null,
        }),
        ...(purchaseprice !== undefined && {
          purchaseprice: purchaseprice ?? null,
        }),
        ...(purchasedate !== undefined && {
          purchasedate: purchasedate ? new Date(purchasedate) : null,
        }),
        ...(expirationdate !== undefined && {
          expirationdate: expirationdate ? new Date(expirationdate) : null,
        }),
        ...(notes !== undefined && { notes: notes ?? null }),
        ...(requestable !== undefined && { requestable: requestable ?? null }),
        ...(licencecategorytypeid !== undefined && { licencecategorytypeid }),
        ...(manufacturerid !== undefined && { manufacturerid }),
        ...(supplierid !== undefined && { supplierid }),
        ...(seatCount !== undefined &&
          typeof seatCount === "number" &&
          seatCount >= 1 && { seatCount }),
        change_date: new Date(),
      },
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.LICENSE,
      entityId: updated.licenceid,
      details: { licencekey: updated.licencekey },
    });

    if (licenceduserid !== undefined) {
      triggerWebhook("license.assigned", {
        licenceId: updated.licenceid,
        userId: updated.licenceduserid,
        licenceKey: updated.licencekey,
      }).catch(() => {});
    }

    invalidateCache("licences_all").catch(() => {});
    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    logger.error("PUT /api/licence error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json({ error: "Licence not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to update licence" },
      { status: 500 },
    );
  }
}

// DELETE /api/licence
export async function DELETE(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    // Require license:delete permission to delete licences
    const admin = await requirePermission("license:delete");

    const body = await req.json();
    const { licenceid } = body;

    // Validate licence ID
    const idValidation = uuidSchema.safeParse(licenceid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid licence ID" },
        { status: 400 },
      );
    }

    // Get licence details before deletion for audit log
    const licence = await prisma.licence.findUnique({
      where: { licenceid },
      select: { licencekey: true },
    });

    if (!licence) {
      return NextResponse.json({ error: "Licence not found" }, { status: 404 });
    }

    // Delete the licence
    await prisma.licence.delete({
      where: { licenceid },
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.DELETE,
      entity: AUDIT_ENTITIES.LICENSE,
      entityId: licenceid,
      details: { licencekey: licence.licencekey },
    });

    return NextResponse.json(
      { message: "Licence deleted successfully" },
      { status: 200 },
    );
  } catch (e) {
    logger.error("DELETE /api/licence error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json({ error: "Licence not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to delete licence" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
