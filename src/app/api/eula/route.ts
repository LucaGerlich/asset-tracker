import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import {
  validateBody,
  createEulaTemplateSchema,
  updateEulaTemplateSchema,
} from "@/lib/validation";
import { logger } from "@/lib/logger";

// GET /api/eula
export async function GET() {
  try {
    await requirePermission("eula:view");

    const templates = await prisma.eulaTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(templates, { status: 200 });
  } catch (e: any) {
    logger.error("GET /api/eula error", { error: e });
    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch EULA templates" },
      { status: 500 },
    );
  }
}

// POST /api/eula
export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("eula:manage");

    const body = await req.json();
    const validated = validateBody(createEulaTemplateSchema, body);
    if (validated instanceof NextResponse) return validated;

    const { name, content, version, isActive } = validated;

    const created = await prisma.eulaTemplate.create({
      data: {
        name,
        content,
        version: version ?? 1,
        isActive: isActive ?? true,
      },
    });

    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.EULA_TEMPLATE,
      entityId: created.id,
      details: { name },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    logger.error("POST /api/eula error", { error: e });
    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to create EULA template" },
      { status: 500 },
    );
  }
}

// PUT /api/eula
export async function PUT(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("eula:manage");

    const body = await req.json();
    const { id, ...rest } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 },
      );
    }

    const validated = validateBody(updateEulaTemplateSchema, rest);
    if (validated instanceof NextResponse) return validated;

    const updateData: Record<string, unknown> = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.content !== undefined) updateData.content = validated.content;
    if (validated.version !== undefined) updateData.version = validated.version;
    if (validated.isActive !== undefined)
      updateData.isActive = validated.isActive;

    const updated = await prisma.eulaTemplate.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.EULA_TEMPLATE,
      entityId: updated.id,
      details: { name: updated.name },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e: any) {
    logger.error("PUT /api/eula error", { error: e });
    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "EULA template not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Failed to update EULA template" },
      { status: 500 },
    );
  }
}

// DELETE /api/eula
export async function DELETE(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("eula:manage");

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 },
      );
    }

    const template = await prisma.eulaTemplate.findUnique({
      where: { id },
      select: { name: true },
    });

    if (!template) {
      return NextResponse.json(
        { error: "EULA template not found" },
        { status: 404 },
      );
    }

    await prisma.eulaTemplate.delete({ where: { id } });

    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.DELETE,
      entity: AUDIT_ENTITIES.EULA_TEMPLATE,
      entityId: id,
      details: { name: template.name },
    });

    return NextResponse.json(
      { message: "EULA template deleted successfully" },
      { status: 200 },
    );
  } catch (e: any) {
    logger.error("DELETE /api/eula error", { error: e });
    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to delete EULA template" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
