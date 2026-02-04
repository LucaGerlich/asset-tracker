import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { Prisma } from "@prisma/client";
import { requireApiAuth, requireApiAdmin } from "@/lib/api-auth";
import { createAccessoryCategoryTypeSchema, updateAccessoryCategoryTypeSchema, uuidSchema } from "@/lib/validation";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";

// GET /api/accessoryCategory
export async function GET() {
  try {
    // Require authentication to view accessory categories
    await requireApiAuth();

    const items = await prisma.accessorieCategoryType.findMany({
      orderBy: { accessoriecategorytypename: "asc" },
    });
    return NextResponse.json(items, { status: 200 });
  } catch (e) {
    console.error("GET /api/accessoryCategory error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch accessory categories" },
      { status: 500 }
    );
  }
}

// POST /api/accessoryCategory
export async function POST(req) {
  try {
    // Only admins can create accessory categories
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate input
    const validationResult = createAccessoryCategoryTypeSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { accessoriecategorytypename } = validationResult.data;

    const created = await prisma.accessorieCategoryType.create({
      data: {
        accessoriecategorytypename,
      } as Prisma.accessorieCategoryTypeUncheckedCreateInput,
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.ACCESSORY_CATEGORY,
      entityId: created.accessoriecategorytypeid,
      details: { accessoriecategorytypename },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("POST /api/accessoryCategory error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create accessory category" },
      { status: 500 }
    );
  }
}

// PUT /api/accessoryCategory
export async function PUT(req) {
  try {
    // Only admins can update accessory categories
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate category ID
    const idValidation = uuidSchema.safeParse(body.accessoriecategorytypeid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid accessory category ID" },
        { status: 400 }
      );
    }

    // Validate update data
    const dataValidation = updateAccessoryCategoryTypeSchema.safeParse(body);
    if (!dataValidation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: dataValidation.error.issues,
        },
        { status: 400 }
      );
    }

    const { accessoriecategorytypeid, accessoriecategorytypename } = body;

    const updated = await prisma.accessorieCategoryType.update({
      where: { accessoriecategorytypeid },
      data: {
        accessoriecategorytypename,
      },
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.ACCESSORY_CATEGORY,
      entityId: updated.accessoriecategorytypeid,
      details: { accessoriecategorytypename },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error("PUT /api/accessoryCategory error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Accessory category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update accessory category" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
