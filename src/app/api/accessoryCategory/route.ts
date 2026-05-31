import { type NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { Prisma } from "@prisma/client";
import {
  requireApiAuth,
  requireApiAdmin,
  requireNotDemoMode,
} from "@/lib/api-auth";
import {
  createAccessoryCategoryTypeSchema,
  updateAccessoryCategoryTypeSchema,
  uuidSchema,
} from "@/lib/validation";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { getOrganizationContext } from "@/lib/organization-context";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { logger } from "@/lib/logger";

const ACCESSORY_CATEGORY_SORT_FIELDS = ["accessoriecategorytypename"];

export async function GET(req: NextRequest) {
  try {
    // Require authentication to view accessory categories
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const searchParams = req.nextUrl.searchParams;

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const items = await prisma.accessorieCategoryType.findMany({
        where: { organizationId: orgId ?? null },
        orderBy: { accessoriecategorytypename: "asc" },
      });
      return NextResponse.json(items, { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, ACCESSORY_CATEGORY_SORT_FIELDS);

    const where: Record<string, unknown> = { organizationId: orgId ?? null };

    // Search filter
    if (params.search) {
      where.OR = [
        {
          accessoriecategorytypename: {
            contains: params.search,
            mode: "insensitive",
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.accessorieCategoryType.findMany({ where, ...prismaArgs }),
      prisma.accessorieCategoryType.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedResponse(items, total, params), {
      status: 200,
    });
  } catch (e) {
    logger.error("GET /api/accessoryCategory error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch accessory categories" },
      { status: 500 },
    );
  }
}

// POST /api/accessoryCategory
export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    // Only admins can create accessory categories
    const admin = await requireApiAdmin();

    const body = await req.json();

    const validationResult = createAccessoryCategoryTypeSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 },
      );
    }

    const { accessoriecategorytypename } = validationResult.data;

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const created = await prisma.accessorieCategoryType.create({
      data: {
        accessoriecategorytypename,
        organizationId: orgId ?? null,
      } as Prisma.accessorieCategoryTypeUncheckedCreateInput,
    });

    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.ACCESSORY_CATEGORY,
      entityId: created.accessoriecategorytypeid,
      details: { accessoriecategorytypename },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    logger.error("POST /api/accessoryCategory error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create accessory category" },
      { status: 500 },
    );
  }
}

// PUT /api/accessoryCategory
export async function PUT(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    // Only admins can update accessory categories
    const admin = await requireApiAdmin();

    const body = await req.json();

    const idValidation = uuidSchema.safeParse(body.accessoriecategorytypeid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid accessory category ID" },
        { status: 400 },
      );
    }

    const dataValidation = updateAccessoryCategoryTypeSchema.safeParse(body);
    if (!dataValidation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: dataValidation.error.issues,
        },
        { status: 400 },
      );
    }

    const { accessoriecategorytypeid, accessoriecategorytypename } = body;

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    // Verify ownership
    const existing = await prisma.accessorieCategoryType.findFirst({
      where: { accessoriecategorytypeid, organizationId: orgId ?? null },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Accessory category not found" },
        { status: 404 },
      );
    }

    const updated = await prisma.accessorieCategoryType.update({
      where: { accessoriecategorytypeid },
      data: {
        accessoriecategorytypename,
      },
    });

    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.ACCESSORY_CATEGORY,
      entityId: updated.accessoriecategorytypeid,
      details: { accessoriecategorytypename },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    logger.error("PUT /api/accessoryCategory error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Accessory category not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update accessory category" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
