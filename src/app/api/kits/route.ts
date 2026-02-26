import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import {
  createAuditLog,
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
} from "@/lib/audit-log";
import {
  validateBody,
  createKitSchema,
  updateKitSchema,
} from "@/lib/validations";
import { logger } from "@/lib/logger";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";

const KIT_SORT_FIELDS = ["name", "createdAt"];

// GET /api/kits
// Pagination: ?page=1&pageSize=25&sortBy=name&sortOrder=asc&search=keyword
export async function GET(req: Request) {
  try {
    await requirePermission("kit:view");
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const { searchParams } = new URL(req.url);

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const where = scopeToOrganization({}, orgId);
      const items = await prisma.kit.findMany({
        where,
        orderBy: { name: "asc" },
        include: { items: true },
      });
      return NextResponse.json(items, { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, KIT_SORT_FIELDS);

    const where: Record<string, unknown> = scopeToOrganization({}, orgId);

    // Search filter (name)
    if (params.search) {
      where.name = { contains: params.search, mode: "insensitive" };
    }

    const [items, total] = await Promise.all([
      prisma.kit.findMany({
        where,
        ...prismaArgs,
        include: { items: true },
      }),
      prisma.kit.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedResponse(items, total, params), {
      status: 200,
    });
  } catch (e: any) {
    logger.error("GET /api/kits error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to fetch kits" },
      { status: 500 },
    );
  }
}

// POST /api/kits
export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("kit:create");

    const body = await req.json();
    const validated = validateBody(createKitSchema, body);
    if (validated instanceof NextResponse) return validated;

    const { name, description, isActive, items } = validated;

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const kit = await prisma.$transaction(async (tx) => {
      const created = await tx.kit.create({
        data: {
          name,
          description: description ?? null,
          isActive: isActive ?? true,
          organizationId: orgId ?? null,
        },
      });

      if (items?.length) {
        await tx.kitItem.createMany({
          data: items.map((item: { entityType: string; entityId: string; quantity?: number; isRequired?: boolean; notes?: string | null }) => ({
            kitId: created.id,
            entityType: item.entityType,
            entityId: item.entityId,
            quantity: item.quantity ?? 1,
            isRequired: item.isRequired ?? true,
            notes: item.notes ?? null,
          })),
        });
      }

      return tx.kit.findUnique({
        where: { id: created.id },
        include: { items: true },
      });
    });

    // Audit log
    await createAuditLog({
      userId: authUser.id ?? null,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.KIT,
      entityId: kit?.id ?? null,
      details: { name },
    });

    return NextResponse.json(kit, { status: 201 });
  } catch (e: any) {
    logger.error("POST /api/kits error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create kit" },
      { status: 500 },
    );
  }
}

// PUT /api/kits
export async function PUT(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("kit:edit");

    const body = await req.json();
    const { id, ...rest } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Kit ID is required" },
        { status: 400 },
      );
    }

    const validated = validateBody(updateKitSchema, rest);
    if (validated instanceof NextResponse) return validated;

    const { name, description, isActive, items } = validated;

    const kit = await prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updated = await tx.kit.update({
        where: { id },
        data: updateData,
      });

      // Replace items if provided
      if (items !== undefined) {
        await tx.kitItem.deleteMany({ where: { kitId: id } });

        if (items?.length) {
          await tx.kitItem.createMany({
            data: items.map((item: { entityType: string; entityId: string; quantity?: number; isRequired?: boolean; notes?: string | null }) => ({
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

      return tx.kit.findUnique({
        where: { id: updated.id },
        include: { items: true },
      });
    });

    // Audit log
    await createAuditLog({
      userId: authUser.id ?? null,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.KIT,
      entityId: kit?.id ?? null,
      details: { name: kit?.name, changes: Object.keys(validated) },
    });

    return NextResponse.json(kit, { status: 200 });
  } catch (e: any) {
    logger.error("PUT /api/kits error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Kit not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update kit" },
      { status: 500 },
    );
  }
}

// DELETE /api/kits
export async function DELETE(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("kit:delete");

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Kit ID is required" },
        { status: 400 },
      );
    }

    // Get kit details before deletion for audit log
    const kit = await prisma.kit.findUnique({
      where: { id },
      select: { name: true },
    });

    if (!kit) {
      return NextResponse.json(
        { error: "Kit not found" },
        { status: 404 },
      );
    }

    await prisma.kit.delete({
      where: { id },
    });

    // Audit log
    await createAuditLog({
      userId: authUser.id ?? null,
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
    logger.error("DELETE /api/kits error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Kit not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to delete kit" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
