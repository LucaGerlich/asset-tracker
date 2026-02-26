import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import {
  createAuditLog,
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
} from "@/lib/audit-log";
import { validateBody, updateComponentSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/components/[id]
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("component:view");

    const { id } = await params;

    const component = await prisma.component.findUnique({
      where: { id },
      include: {
        category: true,
        manufacturer: true,
        supplier: true,
        location: true,
        checkouts: {
          include: {
            asset: true,
            checkedOutByUser: true,
          },
          orderBy: { checkedOutAt: "desc" },
        },
      },
    });

    if (!component) {
      return NextResponse.json(
        { error: "Component not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(component, { status: 200 });
  } catch (e: any) {
    logger.error("GET /api/components/[id] error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to fetch component" },
      { status: 500 },
    );
  }
}

// PUT /api/components/[id]
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("component:edit");

    const { id } = await params;
    const body = await req.json();
    const validated = validateBody(updateComponentSchema, body);
    if (validated instanceof NextResponse) return validated;

    const updateData: Record<string, unknown> = {};

    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.serialNumber !== undefined)
      updateData.serialNumber = validated.serialNumber;
    if (validated.categoryId !== undefined)
      updateData.categoryId = validated.categoryId;
    if (validated.totalQuantity !== undefined)
      updateData.totalQuantity = validated.totalQuantity;
    if (validated.purchasePrice !== undefined)
      updateData.purchasePrice = validated.purchasePrice ?? null;
    if (validated.purchaseDate !== undefined)
      updateData.purchaseDate = validated.purchaseDate
        ? new Date(validated.purchaseDate)
        : null;
    if (validated.minQuantity !== undefined)
      updateData.minQuantity = validated.minQuantity;
    if (validated.manufacturerId !== undefined)
      updateData.manufacturerId = validated.manufacturerId;
    if (validated.supplierId !== undefined)
      updateData.supplierId = validated.supplierId;
    if (validated.locationId !== undefined)
      updateData.locationId = validated.locationId;

    const updated = await prisma.component.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.COMPONENT,
      entityId: updated.id,
      details: { name: updated.name },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e: any) {
    logger.error("PUT /api/components/[id] error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Component not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update component" },
      { status: 500 },
    );
  }
}

// DELETE /api/components/[id]
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("component:delete");

    const { id } = await params;

    const component = await prisma.component.findUnique({
      where: { id },
      select: { name: true },
    });

    if (!component) {
      return NextResponse.json(
        { error: "Component not found" },
        { status: 404 },
      );
    }

    await prisma.component.delete({
      where: { id },
    });

    // Audit log
    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.DELETE,
      entity: AUDIT_ENTITIES.COMPONENT,
      entityId: id,
      details: { name: component.name },
    });

    return NextResponse.json(
      { message: "Component deleted successfully" },
      { status: 200 },
    );
  } catch (e: any) {
    logger.error("DELETE /api/components/[id] error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Component not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to delete component" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
