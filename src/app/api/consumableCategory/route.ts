import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { Prisma } from "@prisma/client";
import { requireApiAuth, requireApiAdmin } from "@/lib/api-auth";
import { createConsumableCategoryTypeSchema, updateConsumableCategoryTypeSchema, uuidSchema } from "@/lib/validation";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";

// GET /api/consumableCategory
export async function GET() {
  try {
    // Require authentication to view consumable categories
    await requireApiAuth();

    const items = await prisma.consumableCategoryType.findMany({
      orderBy: { consumablecategorytypename: "asc" },
    });
    return NextResponse.json(items, { status: 200 });
  } catch (e) {
    console.error("GET /api/consumableCategory error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch consumable categories" },
      { status: 500 }
    );
  }
}

// POST /api/consumableCategory
export async function POST(req) {
  try {
    // Only admins can create consumable categories
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate input
    const validationResult = createConsumableCategoryTypeSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { consumablecategorytypename } = validationResult.data;

    const created = await prisma.consumableCategoryType.create({
      data: {
        consumablecategorytypename,
      } as Prisma.consumableCategoryTypeUncheckedCreateInput,
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.CONSUMABLE_CATEGORY,
      entityId: created.consumablecategorytypeid,
      details: { consumablecategorytypename },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("POST /api/consumableCategory error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create consumable category" },
      { status: 500 }
    );
  }
}

// PUT /api/consumableCategory
export async function PUT(req) {
  try {
    // Only admins can update consumable categories
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate category ID
    const idValidation = uuidSchema.safeParse(body.consumablecategorytypeid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid consumable category ID" },
        { status: 400 }
      );
    }

    // Validate update data
    const dataValidation = updateConsumableCategoryTypeSchema.safeParse(body);
    if (!dataValidation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: dataValidation.error.issues,
        },
        { status: 400 }
      );
    }

    const { consumablecategorytypeid, consumablecategorytypename } = body;

    const updated = await prisma.consumableCategoryType.update({
      where: { consumablecategorytypeid },
      data: {
        consumablecategorytypename,
      },
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.CONSUMABLE_CATEGORY,
      entityId: updated.consumablecategorytypeid,
      details: { consumablecategorytypename },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error("PUT /api/consumableCategory error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Consumable category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update consumable category" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
