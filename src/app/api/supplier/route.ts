import { type NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { Prisma } from "@prisma/client";
import {
  requireApiAuth,
  requireApiAdmin,
  requireNotDemoMode,
} from "@/lib/api-auth";
import {
  createSupplierSchema,
  updateSupplierSchema,
  uuidSchema,
} from "@/lib/validation";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { logger } from "@/lib/logger";
import { invalidateCache } from "@/lib/cache";

const SUPPLIER_SORT_FIELDS = ["suppliername", "email", "creation_date"];

// GET /api/supplier
export async function GET(req: NextRequest) {
  try {
    // Require authentication to view suppliers
    await requireApiAuth();

    const searchParams = req.nextUrl.searchParams;

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const items = await prisma.supplier.findMany({
        orderBy: { suppliername: "asc" },
      });
      return NextResponse.json(items, { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, SUPPLIER_SORT_FIELDS);

    const where: Record<string, unknown> = {};

    // Search filter
    if (params.search) {
      where.OR = [
        { suppliername: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
        { firstname: { contains: params.search, mode: "insensitive" } },
        { lastname: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.supplier.findMany({ where, ...prismaArgs }),
      prisma.supplier.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedResponse(items, total, params), {
      status: 200,
    });
  } catch (e) {
    logger.error("GET /api/supplier error", { error: e });

    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch suppliers" },
      { status: 500 },
    );
  }
}

// POST /api/supplier
export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    // Only admins can create suppliers
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate input
    const validationResult = createSupplierSchema.safeParse(body);
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
      suppliername,
      firstname,
      lastname,
      salutation,
      email,
      phonenumber,
      website,
    } = validationResult.data;

    const created = await prisma.supplier.create({
      data: {
        suppliername,
        firstname: firstname ?? null,
        lastname: lastname ?? null,
        salutation: salutation ?? null,
        email: email ?? null,
        phonenumber: phonenumber ?? null,
        website: website ?? null,
        creation_date: new Date(),
      } as Prisma.supplierUncheckedCreateInput,
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.SUPPLIER,
      entityId: created.supplierid,
      details: { suppliername },
    });

    invalidateCache("suppliers").catch(() => {});
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    logger.error("POST /api/supplier error", { error: e });

    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof Error && e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create supplier" },
      { status: 500 },
    );
  }
}

// PUT /api/supplier
export async function PUT(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    // Only admins can update suppliers
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate supplier ID
    const idValidation = uuidSchema.safeParse(body.supplierid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid supplier ID" },
        { status: 400 },
      );
    }

    // Validate update data
    const dataValidation = updateSupplierSchema.safeParse(body);
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
      supplierid,
      suppliername,
      firstname,
      lastname,
      salutation,
      email,
      phonenumber,
      website,
    } = body;

    const updated = await prisma.supplier.update({
      where: { supplierid },
      data: {
        ...(suppliername !== undefined && { suppliername }),
        ...(firstname !== undefined && { firstname: firstname ?? null }),
        ...(lastname !== undefined && { lastname: lastname ?? null }),
        ...(salutation !== undefined && { salutation: salutation ?? null }),
        ...(email !== undefined && { email: email ?? null }),
        ...(phonenumber !== undefined && { phonenumber: phonenumber ?? null }),
        ...(website !== undefined && { website: website ?? null }),
        change_date: new Date(),
      },
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.SUPPLIER,
      entityId: updated.supplierid,
      details: { suppliername: updated.suppliername },
    });

    invalidateCache("suppliers").catch(() => {});
    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    logger.error("PUT /api/supplier error", { error: e });

    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof Error && e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update supplier" },
      { status: 500 },
    );
  }
}

// DELETE /api/supplier
export async function DELETE(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    // Only admins can delete suppliers
    const admin = await requireApiAdmin();

    const body = await req.json();
    const { supplierid } = body;

    // Validate supplier ID
    const idValidation = uuidSchema.safeParse(supplierid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid supplier ID" },
        { status: 400 },
      );
    }

    // Get supplier details before deletion for audit log
    const supplier = await prisma.supplier.findUnique({
      where: { supplierid },
      select: { suppliername: true },
    });

    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 },
      );
    }

    // Check for referencing records before deleting
    const [
      assetRefs,
      accessoriesRefs,
      consumableRefs,
      licenceRefs,
      componentRefs,
    ] = await Promise.all([
      prisma.asset.count({ where: { supplierid } }),
      prisma.accessories.count({ where: { supplierid } }),
      prisma.consumable.count({ where: { supplierid } }),
      prisma.licence.count({ where: { supplierid } }),
      prisma.component.count({ where: { supplierId: supplierid } }),
    ]);
    const totalRefs =
      assetRefs +
      accessoriesRefs +
      consumableRefs +
      licenceRefs +
      componentRefs;
    if (totalRefs > 0) {
      const details = [
        assetRefs > 0 && `${assetRefs} asset(s)`,
        accessoriesRefs > 0 && `${accessoriesRefs} accessory/ies`,
        consumableRefs > 0 && `${consumableRefs} consumable(s)`,
        licenceRefs > 0 && `${licenceRefs} licence(s)`,
        componentRefs > 0 && `${componentRefs} component(s)`,
      ]
        .filter(Boolean)
        .join(", ");
      return NextResponse.json(
        { error: `Cannot delete: ${details} still reference this supplier` },
        { status: 409 },
      );
    }

    // Delete the supplier
    await prisma.supplier.delete({
      where: { supplierid },
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.DELETE,
      entity: AUDIT_ENTITIES.SUPPLIER,
      entityId: supplierid,
      details: { suppliername: supplier.suppliername },
    });

    invalidateCache("suppliers").catch(() => {});
    return NextResponse.json(
      { message: "Supplier deleted successfully" },
      { status: 200 },
    );
  } catch (e) {
    logger.error("DELETE /api/supplier error", { error: e });

    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof Error && e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to delete supplier" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
