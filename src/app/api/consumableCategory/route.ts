import { type NextRequest, NextResponse } from "next/server";
import { invalidateCacheByPrefix } from "@/lib/cache";
import prisma from "../../../lib/prisma";
import { Prisma } from "@prisma/client";
import {
  requireApiAuth,
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import {
  createConsumableCategoryTypeSchema,
  updateConsumableCategoryTypeSchema,
  deleteConsumableCategoryTypeSchema,
  uuidSchema,
  validateBody,
} from "@/lib/validation";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { getOrganizationContext } from "@/lib/organization-context";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { logger } from "@/lib/logger";

const CONSUMABLE_CATEGORY_SORT_FIELDS = ["consumablecategorytypename"];

export async function GET(req: NextRequest) {
  try {
    // Require authentication to view consumable categories
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const searchParams = req.nextUrl.searchParams;

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const items = await prisma.consumableCategoryType.findMany({
        where: { organizationId: orgId ?? null },
        orderBy: { consumablecategorytypename: "asc" },
      });
      return NextResponse.json(items, { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, CONSUMABLE_CATEGORY_SORT_FIELDS);

    const where: Record<string, unknown> = { organizationId: orgId ?? null };

    // Search filter
    if (params.search) {
      where.OR = [
        {
          consumablecategorytypename: {
            contains: params.search,
            mode: "insensitive",
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.consumableCategoryType.findMany({ where, ...prismaArgs }),
      prisma.consumableCategoryType.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedResponse(items, total, params), {
      status: 200,
    });
  } catch (e) {
    const denied = apiErrorResponse(e);
    if (denied) return denied;
    logger.error("GET /api/consumableCategory error", { error: e });

    return NextResponse.json(
      { error: "Failed to fetch consumable categories" },
      { status: 500 },
    );
  }
}

// POST /api/consumableCategory
export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    // Only admins can create consumable categories
    const admin = await requireApiAdmin();
    await requireWritableOrg(admin);

    const body = await req.json();

    const validationResult = createConsumableCategoryTypeSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 },
      );
    }

    const { consumablecategorytypename } = validationResult.data;

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const created = await prisma.consumableCategoryType.create({
      data: {
        consumablecategorytypename,
        organizationId: orgId ?? null,
      } as Prisma.consumableCategoryTypeUncheckedCreateInput,
    });

    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.CONSUMABLE_CATEGORY,
      entityId: created.consumablecategorytypeid,
      details: { consumablecategorytypename },
    });

    await invalidateCacheByPrefix("consumable_categories").catch(() => {});

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const denied = apiErrorResponse(e);
    if (denied) return denied;
    logger.error("POST /api/consumableCategory error", { error: e });

    return NextResponse.json(
      { error: "Failed to create consumable category" },
      { status: 500 },
    );
  }
}

// PUT /api/consumableCategory
export async function PUT(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    // Only admins can update consumable categories
    const admin = await requireApiAdmin();
    await requireWritableOrg(admin);

    const body = await req.json();

    const idValidation = uuidSchema.safeParse(body.consumablecategorytypeid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid consumable category ID" },
        { status: 400 },
      );
    }

    const dataValidation = updateConsumableCategoryTypeSchema.safeParse(body);
    if (!dataValidation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: dataValidation.error.issues,
        },
        { status: 400 },
      );
    }

    const { consumablecategorytypeid, consumablecategorytypename } = body;

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    // Verify ownership
    const existing = await prisma.consumableCategoryType.findFirst({
      where: { consumablecategorytypeid, organizationId: orgId ?? null },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Consumable category not found" },
        { status: 404 },
      );
    }

    const updated = await prisma.consumableCategoryType.update({
      where: { consumablecategorytypeid },
      data: {
        consumablecategorytypename,
      },
    });

    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.CONSUMABLE_CATEGORY,
      entityId: updated.consumablecategorytypeid,
      details: { consumablecategorytypename },
    });

    await invalidateCacheByPrefix("consumable_categories").catch(() => {});

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    const denied = apiErrorResponse(e);
    if (denied) return denied;
    logger.error("PUT /api/consumableCategory error", { error: e });

    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Consumable category not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update consumable category" },
      { status: 500 },
    );
  }
}

// DELETE /api/consumableCategory
export async function DELETE(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    // Only admins can delete consumable categories
    const admin = await requireApiAdmin();
    await requireWritableOrg(admin);

    const body = await req.json();
    const validated = validateBody(deleteConsumableCategoryTypeSchema, body);
    if (validated instanceof NextResponse) return validated;
    const { consumablecategorytypeid } = validated;

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    // Scope the lookup so foreign-org categories read as "not found".
    const category = await prisma.consumableCategoryType.findFirst({
      where: { consumablecategorytypeid, organizationId: orgId ?? null },
      select: { consumablecategorytypename: true },
    });
    if (!category) {
      return NextResponse.json(
        { error: "Consumable category not found" },
        { status: 404 },
      );
    }

    // Deliberately unscoped by organization: the FKs are NoAction, so a row
    // from any tenant would block the delete. Only existence is reported, never
    // a count, so nothing about other tenants leaks.
    const inUse = await prisma.consumable.findFirst({
      where: { consumablecategorytypeid },
      select: { consumablecategorytypeid: true },
    });
    if (inUse) {
      return NextResponse.json(
        { error: "Category is still in use. Reassign its items first." },
        { status: 409 },
      );
    }

    await prisma.consumableCategoryType.delete({
      where: { consumablecategorytypeid },
    });

    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.DELETE,
      entity: AUDIT_ENTITIES.CONSUMABLE_CATEGORY,
      entityId: consumablecategorytypeid,
      details: {
        consumablecategorytypename: category.consumablecategorytypename,
      },
    });

    await invalidateCacheByPrefix("consumable_categories").catch(() => {});

    return NextResponse.json(
      { message: "Consumable category deleted successfully" },
      { status: 200 },
    );
  } catch (e) {
    const denied = apiErrorResponse(e);
    if (denied) return denied;
    logger.error("DELETE /api/consumableCategory error", { error: e });

    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "Consumable category not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to delete consumable category" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
