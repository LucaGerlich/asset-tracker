import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { Prisma } from "@prisma/client";
import { requireApiAuth, requireApiAdmin } from "@/lib/api-auth";
import { createLicenseSchema, updateLicenseSchema, uuidSchema } from "@/lib/validation";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { getOrganizationContext, scopeToOrganization } from "@/lib/organization-context";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";

const LICENCE_SORT_FIELDS = ["licencekey", "creation_date"];

// GET /api/licence
// Pagination: ?page=1&pageSize=25&sortBy=licencekey&sortOrder=asc&search=keyword
export async function GET(req) {
  try {
    // Require authentication to view licences
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const searchParams = req.nextUrl.searchParams;

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const where = scopeToOrganization({}, orgId);
      const items = await prisma.licence.findMany({
        where,
        orderBy: { creation_date: "desc" },
      });
      return NextResponse.json(items, { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, LICENCE_SORT_FIELDS);

    const where: Record<string, unknown> = scopeToOrganization({}, orgId);

    // Search filter (licencekey)
    if (params.search) {
      where.licencekey = { contains: params.search, mode: "insensitive" };
    }

    const [items, total] = await Promise.all([
      prisma.licence.findMany({ where, ...prismaArgs }),
      prisma.licence.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginatedResponse(items, total, params),
      { status: 200 },
    );
  } catch (e) {
    console.error("GET /api/licence error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: "Failed to fetch licences" }, { status: 500 });
  }
}

// POST /api/licence
export async function POST(req) {
  try {
    // Only admins can create licences
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate input
    const validationResult = createLicenseSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 }
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

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("POST /api/licence error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json({ error: "Failed to create licence" }, { status: 500 });
  }
}

// PUT /api/licence
export async function PUT(req) {
  try {
    // Only admins can update licences
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate licence ID
    const idValidation = uuidSchema.safeParse(body.licenceid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid licence ID" },
        { status: 400 }
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
        { status: 400 }
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
    } = body;

    const updated = await prisma.licence.update({
      where: { licenceid },
      data: {
        ...(licencekey !== undefined && { licencekey: licencekey ?? null }),
        ...(licenceduserid !== undefined && { licenceduserid: licenceduserid ?? null }),
        ...(licensedtoemail !== undefined && { licensedtoemail: licensedtoemail ?? null }),
        ...(purchaseprice !== undefined && { purchaseprice: purchaseprice ?? null }),
        ...(purchasedate !== undefined && { purchasedate: purchasedate ? new Date(purchasedate) : null }),
        ...(expirationdate !== undefined && { expirationdate: expirationdate ? new Date(expirationdate) : null }),
        ...(notes !== undefined && { notes: notes ?? null }),
        ...(requestable !== undefined && { requestable: requestable ?? null }),
        ...(licencecategorytypeid !== undefined && { licencecategorytypeid }),
        ...(manufacturerid !== undefined && { manufacturerid }),
        ...(supplierid !== undefined && { supplierid }),
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

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error("PUT /api/licence error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Licence not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ error: "Failed to update licence" }, { status: 500 });
  }
}

// DELETE /api/licence
export async function DELETE(req) {
  try {
    // Only admins can delete licences
    const admin = await requireApiAdmin();

    const body = await req.json();
    const { licenceid } = body;

    // Validate licence ID
    const idValidation = uuidSchema.safeParse(licenceid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid licence ID" },
        { status: 400 }
      );
    }

    // Get licence details before deletion for audit log
    const licence = await prisma.licence.findUnique({
      where: { licenceid },
      select: { licencekey: true },
    });

    if (!licence) {
      return NextResponse.json(
        { error: "Licence not found" },
        { status: 404 }
      );
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
      { status: 200 }
    );
  } catch (e) {
    console.error("DELETE /api/licence error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Licence not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete licence" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
