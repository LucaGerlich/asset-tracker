import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import {
  validateBody,
  createComponentSchema,
  updateComponentSchema,
} from "@/lib/validation";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";
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

const COMPONENT_SORT_FIELDS = ["name", "remainingQuantity", "createdAt"];

// GET /api/components
// Pagination: ?page=1&pageSize=25&sortBy=name&sortOrder=asc&search=keyword
export async function GET(req: Request) {
  try {
    await requirePermission("component:view");
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const { searchParams } = new URL(req.url);

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const where = scopeToOrganization({}, orgId);
      const items = await prisma.component.findMany({
        where,
        orderBy: { name: "asc" },
        include: {
          category: true,
          manufacturer: true,
          supplier: true,
          location: true,
        },
      });
      return NextResponse.json(items, { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, COMPONENT_SORT_FIELDS);

    const where: Record<string, unknown> = scopeToOrganization({}, orgId);

    // Full-text search using tsvector GIN index (falls back to ILIKE if needed)
    if (params.search) {
      const tsQuery = params.search.trim().split(/\s+/).join(" & ");
      const matchingIds = await prisma
        .$queryRawUnsafe<
          Array<{ id: string }>
        >(`SELECT "id" FROM "components" WHERE "search_vector" @@ websearch_to_tsquery('english', $1)`, tsQuery)
        .catch(() => null);

      if (matchingIds && matchingIds.length > 0) {
        where.id = { in: matchingIds.map((r) => r.id) };
      } else if (matchingIds) {
        // tsvector returned no results — empty set
        where.id = { in: [] };
      } else {
        // Fallback to ILIKE if tsvector query failed (e.g. migration not applied yet)
        where.OR = [
          { name: { contains: params.search, mode: "insensitive" } },
          { serialNumber: { contains: params.search, mode: "insensitive" } },
        ];
      }
    }

    const [items, total] = await Promise.all([
      prisma.component.findMany({
        where,
        ...prismaArgs,
        include: {
          category: true,
          manufacturer: true,
          supplier: true,
          location: true,
        },
      }),
      prisma.component.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedResponse(items, total, params), {
      status: 200,
    });
  } catch (e: any) {
    logger.error("GET /api/components error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to fetch components" },
      { status: 500 },
    );
  }
}

// POST /api/components
export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("component:create");

    const body = await req.json();
    const validated = validateBody(createComponentSchema, body);
    if (validated instanceof NextResponse) return validated;

    const {
      name,
      serialNumber,
      categoryId,
      totalQuantity,
      purchasePrice,
      purchaseDate,
      minQuantity,
      manufacturerId,
      supplierId,
      locationId,
    } = validated;

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const created = await prisma.component.create({
      data: {
        name,
        serialNumber: serialNumber ?? null,
        categoryId: categoryId ?? null,
        totalQuantity: totalQuantity ?? 0,
        remainingQuantity: totalQuantity ?? 0,
        purchasePrice: purchasePrice ?? null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        minQuantity: minQuantity ?? 0,
        manufacturerId: manufacturerId ?? null,
        supplierId: supplierId ?? null,
        locationId: locationId ?? null,
        organizationId: orgId ?? null,
      } as Prisma.ComponentUncheckedCreateInput,
    });

    // Audit log
    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.COMPONENT,
      entityId: created.id,
      details: { name },
    });

    // Webhook + integrations
    triggerWebhook("component.created", {
      componentId: created.id,
      componentName: created.name,
    }).catch(() => {});
    notifyIntegrations("component.created", {
      componentName: created.name,
    }).catch(() => {});

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    logger.error("POST /api/components error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create component" },
      { status: 500 },
    );
  }
}

// PUT /api/components
export async function PUT(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("component:edit");

    const body = await req.json();
    const { id, ...rest } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Component ID is required" },
        { status: 400 },
      );
    }

    const validated = validateBody(updateComponentSchema, rest);
    if (validated instanceof NextResponse) return validated;

    const data = validated;

    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.serialNumber !== undefined)
      updateData.serialNumber = data.serialNumber;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.totalQuantity !== undefined)
      updateData.totalQuantity = data.totalQuantity;
    if ((body as any).remainingQuantity !== undefined)
      updateData.remainingQuantity = (body as any).remainingQuantity;
    if (data.purchasePrice !== undefined)
      updateData.purchasePrice = data.purchasePrice ?? null;
    if (data.purchaseDate !== undefined)
      updateData.purchaseDate = data.purchaseDate
        ? new Date(data.purchaseDate)
        : null;
    if (data.minQuantity !== undefined)
      updateData.minQuantity = data.minQuantity;
    if (data.manufacturerId !== undefined)
      updateData.manufacturerId = data.manufacturerId;
    if (data.supplierId !== undefined) updateData.supplierId = data.supplierId;
    if (data.locationId !== undefined) updateData.locationId = data.locationId;

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
      details: { name: updated.name, changes: Object.keys(data) },
    });

    // Webhook + integrations
    triggerWebhook("component.updated", {
      componentId: updated.id,
      componentName: updated.name,
      changes: Object.keys(data),
    }).catch(() => {});
    notifyIntegrations("component.updated", {
      componentName: updated.name,
    }).catch(() => {});

    return NextResponse.json(updated, { status: 200 });
  } catch (e: any) {
    logger.error("PUT /api/components error", { error: e });

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

// DELETE /api/components
export async function DELETE(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("component:delete");

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Component ID is required" },
        { status: 400 },
      );
    }

    // Get component details before deletion for audit log
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

    // Webhook + integrations
    triggerWebhook("component.deleted", {
      componentId: id,
      componentName: component.name,
    }).catch(() => {});
    notifyIntegrations("component.deleted", {
      componentName: component.name,
    }).catch(() => {});

    return NextResponse.json(
      { message: "Component deleted successfully" },
      { status: 200 },
    );
  } catch (e: any) {
    logger.error("DELETE /api/components error", { error: e });

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
