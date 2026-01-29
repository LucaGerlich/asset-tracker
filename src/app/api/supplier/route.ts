import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { Prisma } from "@prisma/client";
import { requireApiAuth, requireApiAdmin } from "@/lib/api-auth";
import { createSupplierSchema, updateSupplierSchema, uuidSchema } from "@/lib/validation";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";

// GET /api/supplier
export async function GET() {
  try {
    // Require authentication to view suppliers
    await requireApiAuth();

    const items = await prisma.supplier.findMany({
      orderBy: { suppliername: "asc" },
    });
    return NextResponse.json(items, { status: 200 });
  } catch (e) {
    console.error("GET /api/supplier error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ error: "Failed to fetch suppliers" }, { status: 500 });
  }
}

// POST /api/supplier
export async function POST(req) {
  try {
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
        { status: 400 }
      );
    }

    const { suppliername, firstname, lastname, salutation, email, phonenumber } = validationResult.data;

    const created = await prisma.supplier.create({
      data: {
        suppliername,
        firstname: firstname ?? null,
        lastname: lastname ?? null,
        salutation: salutation ?? null,
        email: email ?? null,
        phonenumber: phonenumber ?? null,
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

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("POST /api/supplier error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 });
  }
}

// PUT /api/supplier
export async function PUT(req) {
  try {
    // Only admins can update suppliers
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate supplier ID
    const idValidation = uuidSchema.safeParse(body.supplierid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid supplier ID" },
        { status: 400 }
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
        { status: 400 }
      );
    }

    const { supplierid, suppliername, firstname, lastname, salutation, email, phonenumber } = body;

    const updated = await prisma.supplier.update({
      where: { supplierid },
      data: {
        ...(suppliername !== undefined && { suppliername }),
        ...(firstname !== undefined && { firstname: firstname ?? null }),
        ...(lastname !== undefined && { lastname: lastname ?? null }),
        ...(salutation !== undefined && { salutation: salutation ?? null }),
        ...(email !== undefined && { email: email ?? null }),
        ...(phonenumber !== undefined && { phonenumber: phonenumber ?? null }),
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

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error("PUT /api/supplier error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ error: "Failed to update supplier" }, { status: 500 });
  }
}

// DELETE /api/supplier
export async function DELETE(req) {
  try {
    // Only admins can delete suppliers
    const admin = await requireApiAdmin();

    const body = await req.json();
    const { supplierid } = body;

    // Validate supplier ID
    const idValidation = uuidSchema.safeParse(supplierid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid supplier ID" },
        { status: 400 }
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
        { status: 404 }
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

    return NextResponse.json(
      { message: "Supplier deleted successfully" },
      { status: 200 }
    );
  } catch (e) {
    console.error("DELETE /api/supplier error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete supplier" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
