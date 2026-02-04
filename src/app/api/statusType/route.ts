import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireApiAuth, requireApiAdmin } from "@/lib/api-auth";
import { createStatusTypeSchema, updateStatusTypeSchema, uuidSchema } from "@/lib/validation";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";

// GET /api/statusType
export async function GET() {
  try {
    // Require authentication to view status types
    await requireApiAuth();

    const items = await prisma.statusType.findMany({
      orderBy: { statustypename: "asc" },
    });
    return NextResponse.json(items, { status: 200 });
  } catch (e) {
    console.error("GET /api/statusType error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch status types" },
      { status: 500 }
    );
  }
}

// POST /api/statusType
export async function POST(req) {
  try {
    // Only admins can create status types
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate input
    const validationResult = createStatusTypeSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { statustypename } = validationResult.data;

    const created = await prisma.statusType.create({
      data: {
        statustypename,
      },
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.STATUS_TYPE,
      entityId: created.statustypeid,
      details: { statustypename },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("POST /api/statusType error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create status type" },
      { status: 500 }
    );
  }
}

// PUT /api/statusType
export async function PUT(req) {
  try {
    // Only admins can update status types
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate status ID
    const idValidation = uuidSchema.safeParse(body.statustypeid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid status type ID" },
        { status: 400 }
      );
    }

    // Validate update data
    const dataValidation = updateStatusTypeSchema.safeParse(body);
    if (!dataValidation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: dataValidation.error.issues,
        },
        { status: 400 }
      );
    }

    const { statustypeid, statustypename } = body;

    const updated = await prisma.statusType.update({
      where: { statustypeid },
      data: {
        statustypename,
      },
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.STATUS_TYPE,
      entityId: updated.statustypeid,
      details: { statustypename },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error("PUT /api/statusType error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Status type not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update status type" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
