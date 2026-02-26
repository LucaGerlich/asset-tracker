import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import {
  createAuditLog,
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
} from "@/lib/audit-log";
import { validateBody, updateEulaTemplateSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/eula/[id]
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("eula:view");
    const { id } = await params;

    const template = await prisma.eulaTemplate.findUnique({
      where: { id },
      include: { acceptances: { take: 10, orderBy: { acceptedAt: "desc" } } },
    });

    if (!template) {
      return NextResponse.json(
        { error: "EULA template not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(template, { status: 200 });
  } catch (e: any) {
    logger.error("GET /api/eula/[id] error", { error: e });
    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch EULA template" },
      { status: 500 },
    );
  }
}

// PUT /api/eula/[id]
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("eula:manage");
    const { id } = await params;

    const body = await req.json();
    const validated = validateBody(updateEulaTemplateSchema, body);
    if (validated instanceof NextResponse) return validated;

    const updateData: Record<string, unknown> = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.content !== undefined) updateData.content = validated.content;
    if (validated.version !== undefined) updateData.version = validated.version;
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive;

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
    logger.error("PUT /api/eula/[id] error", { error: e });
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

// DELETE /api/eula/[id]
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("eula:manage");
    const { id } = await params;

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
    logger.error("DELETE /api/eula/[id] error", { error: e });
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
