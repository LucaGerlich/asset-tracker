import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { Prisma } from "@prisma/client";
import { requireApiAuth, requireApiAdmin } from "@/lib/api-auth";
import { createModelSchema, updateModelSchema, uuidSchema } from "@/lib/validation";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";

// GET /api/model
export async function GET() {
  try {
    // Require authentication to view models
    await requireApiAuth();

    const items = await prisma.model.findMany({
      orderBy: { modelname: "asc" },
    });
    return NextResponse.json(items, { status: 200 });
  } catch (e) {
    console.error("GET /api/model error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch models" },
      { status: 500 }
    );
  }
}

// POST /api/model
export async function POST(req) {
  try {
    // Only admins can create models
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate input
    const validationResult = createModelSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { modelname, modelnumber } = validationResult.data;

    const created = await prisma.model.create({
      data: {
        modelname,
        modelnumber: modelnumber || null,
        creation_date: new Date(),
      } as Prisma.modelUncheckedCreateInput,
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.MODEL,
      entityId: created.modelid,
      details: { modelname, modelnumber },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("POST /api/model error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create model" },
      { status: 500 }
    );
  }
}

// PUT /api/model
export async function PUT(req) {
  try {
    // Only admins can update models
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate model ID
    const idValidation = uuidSchema.safeParse(body.modelid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid model ID" },
        { status: 400 }
      );
    }

    // Validate update data
    const dataValidation = updateModelSchema.safeParse(body);
    if (!dataValidation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: dataValidation.error.issues,
        },
        { status: 400 }
      );
    }

    const { modelid, modelname, modelnumber } = body;

    const updated = await prisma.model.update({
      where: { modelid },
      data: {
        modelname,
        modelnumber: modelnumber || null,
        change_date: new Date(),
      },
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.MODEL,
      entityId: updated.modelid,
      details: { modelname, modelnumber },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error("PUT /api/model error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Model not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update model" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
