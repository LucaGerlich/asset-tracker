import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireApiAuth, requireApiAdmin } from "@/lib/api-auth";
import { createManufacturerSchema, updateManufacturerSchema, uuidSchema } from "@/lib/validation";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";

// GET /api/manufacturer
export async function GET() {
  try {
    // Require authentication to view manufacturers
    await requireApiAuth();

    const items = await prisma.manufacturer.findMany({
      orderBy: { manufacturername: "asc" },
    });
    return NextResponse.json(items, { status: 200 });
  } catch (e) {
    console.error("GET /api/manufacturer error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch manufacturers" },
      { status: 500 }
    );
  }
}

// POST /api/manufacturer
export async function POST(req) {
  try {
    // Only admins can create manufacturers
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate input
    const validationResult = createManufacturerSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { manufacturername } = validationResult.data;

    const created = await prisma.manufacturer.create({
      data: {
        manufacturername,
      },
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.MANUFACTURER,
      entityId: created.manufacturerid,
      details: { manufacturername },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("POST /api/manufacturer error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create manufacturer" },
      { status: 500 }
    );
  }
}

// PUT /api/manufacturer
export async function PUT(req) {
  try {
    // Only admins can update manufacturers
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate manufacturer ID
    const idValidation = uuidSchema.safeParse(body.manufacturerid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid manufacturer ID" },
        { status: 400 }
      );
    }

    // Validate update data
    const dataValidation = updateManufacturerSchema.safeParse(body);
    if (!dataValidation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: dataValidation.error.errors,
        },
        { status: 400 }
      );
    }

    const { manufacturerid, manufacturername } = body;

    const updated = await prisma.manufacturer.update({
      where: { manufacturerid },
      data: {
        manufacturername,
        change_date: new Date(),
      },
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.MANUFACTURER,
      entityId: updated.manufacturerid,
      details: { manufacturername },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error("PUT /api/manufacturer error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Manufacturer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update manufacturer" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";

