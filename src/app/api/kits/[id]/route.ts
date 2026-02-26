import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import {
  createAuditLog,
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
} from "@/lib/audit-log";
import { validateBody, updateKitSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/kits/[id]
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("kit:view");
    const { id } = await params;

    const kit = await prisma.kit.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!kit) {
      return NextResponse.json({ error: "Kit not found" }, { status: 404 });
    }

    return NextResponse.json(kit, { status: 200 });
  } catch (e: any) {
    logger.error("GET /api/kits/[id] error", { error: e });
    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch kit" },
      { status: 500 },
    );
  }
}

// PUT /api/kits/[id]
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("kit:edit");
    const { id } = await params;

    const body = await req.json();
    const validated = validateBody(updateKitSchema, body);
    if (validated instanceof NextResponse) return validated;

    const { name, description, isActive, items } = validated;

    const kit = await prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updated = await tx.kit.update({ where: { id }, data: updateData });

      if (items !== undefined) {
        await tx.kitItem.deleteMany({ where: { kitId: id } });
        if (items?.length) {
          await tx.kitItem.createMany({
            data: items.map((item: any) => ({
              kitId: updated.id,
              entityType: item.entityType,
              entityId: item.entityId,
              quantity: item.quantity ?? 1,
              isRequired: item.isRequired ?? true,
              notes: item.notes ?? null,
            })),
          });
        }
      }

      return tx.kit.findUnique({ where: { id }, include: { items: true } });
    });

    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.KIT,
      entityId: id,
      details: { name: kit?.name },
    });

    return NextResponse.json(kit, { status: 200 });
  } catch (e: any) {
    logger.error("PUT /api/kits/[id] error", { error: e });
    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json({ error: "Kit not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to update kit" },
      { status: 500 },
    );
  }
}

// DELETE /api/kits/[id]
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("kit:delete");
    const { id } = await params;

    const kit = await prisma.kit.findUnique({
      where: { id },
      select: { name: true },
    });

    if (!kit) {
      return NextResponse.json({ error: "Kit not found" }, { status: 404 });
    }

    await prisma.kit.delete({ where: { id } });

    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.DELETE,
      entity: AUDIT_ENTITIES.KIT,
      entityId: id,
      details: { name: kit.name },
    });

    return NextResponse.json(
      { message: "Kit deleted successfully" },
      { status: 200 },
    );
  } catch (e: any) {
    logger.error("DELETE /api/kits/[id] error", { error: e });
    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to delete kit" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
