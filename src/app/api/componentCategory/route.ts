import { NextResponse } from "next/server";
import { invalidateCacheByPrefix } from "@/lib/cache";
import prisma from "@/lib/prisma";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import {
  validateBody,
  createComponentCategorySchema,
  updateComponentCategorySchema,
} from "@/lib/validation";
import { getOrganizationContext } from "@/lib/organization-context";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    await requirePermission("component:view");

    const categories = await prisma.componentCategory.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json(categories, { status: 200 });
  } catch (e: any) {
    logger.error("GET /api/componentCategory error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to fetch component categories" },
      { status: 500 },
    );
  }
}

// POST /api/componentCategory
export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("component:create");

    const body = await req.json();
    const validated = validateBody(createComponentCategorySchema, body);
    if (validated instanceof NextResponse) return validated;

    const { name } = validated;

    const created = await prisma.componentCategory.create({
      data: { name },
    });

    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.COMPONENT_CATEGORY,
      entityId: created.id,
      details: { name },
    });

    await invalidateCacheByPrefix("component_categories").catch(() => {});

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    logger.error("POST /api/componentCategory error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create component category" },
      { status: 500 },
    );
  }
}

// PUT /api/componentCategory
export async function PUT(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("component:edit");

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Category ID is required" },
        { status: 400 },
      );
    }

    const validated = validateBody(updateComponentCategorySchema, body);
    if (validated instanceof NextResponse) return validated;

    const { name } = validated;

    const updated = await prisma.componentCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
      },
    });

    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.COMPONENT_CATEGORY,
      entityId: updated.id,
      details: { name: updated.name },
    });

    await invalidateCacheByPrefix("component_categories").catch(() => {});

    return NextResponse.json(updated, { status: 200 });
  } catch (e: any) {
    logger.error("PUT /api/componentCategory error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Component category not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update component category" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("component:delete");
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Category ID is required" },
        { status: 400 },
      );
    }

    // Scope the lookup so foreign-org categories read as "not found".
    const category = await prisma.componentCategory.findFirst({
      where: { id, organizationId: orgId ?? null },
      select: { name: true },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Component category not found" },
        { status: 404 },
      );
    }

    await prisma.componentCategory.delete({
      where: { id },
    });

    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.DELETE,
      entity: AUDIT_ENTITIES.COMPONENT_CATEGORY,
      entityId: id,
      details: { name: category.name },
    });

    await invalidateCacheByPrefix("component_categories").catch(() => {});

    return NextResponse.json(
      { message: "Component category deleted successfully" },
      { status: 200 },
    );
  } catch (e: any) {
    logger.error("DELETE /api/componentCategory error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Component category not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to delete component category" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
