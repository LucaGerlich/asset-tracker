import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { Prisma } from "@prisma/client";
import { requireApiAuth, requireApiAdmin } from "@/lib/api-auth";
import { createAssetCategoryTypeSchema, updateAssetCategoryTypeSchema, uuidSchema } from "@/lib/validation";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";

const ASSET_CATEGORY_SORT_FIELDS = ["assetcategorytypename"];

// GET /api/assetCategory
export async function GET(req) {
  try {
    // Require authentication to view asset categories
    await requireApiAuth();

    const searchParams = req.nextUrl.searchParams;

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const items = await prisma.assetCategoryType.findMany({
        orderBy: { assetcategorytypename: "asc" },
      });
      return NextResponse.json(items, { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, ASSET_CATEGORY_SORT_FIELDS);

    const where: Record<string, unknown> = {};

    // Search filter
    if (params.search) {
      where.OR = [
        { assetcategorytypename: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.assetCategoryType.findMany({ where, ...prismaArgs }),
      prisma.assetCategoryType.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginatedResponse(items, total, params),
      { status: 200 },
    );
  } catch (e) {
    console.error("GET /api/assetCategory error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch asset categories" },
      { status: 500 }
    );
  }
}

// POST /api/assetCategory
export async function POST(req) {
  try {
    // Only admins can create asset categories
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate input
    const validationResult = createAssetCategoryTypeSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { assetcategorytypename } = validationResult.data;

    const created = await prisma.assetCategoryType.create({
      data: {
        assetcategorytypename,
      } as Prisma.assetCategoryTypeUncheckedCreateInput,
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.ASSET_CATEGORY,
      entityId: created.assetcategorytypeid,
      details: { assetcategorytypename },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("POST /api/assetCategory error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create asset category" },
      { status: 500 }
    );
  }
}

// PUT /api/assetCategory
export async function PUT(req) {
  try {
    // Only admins can update asset categories
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate category ID
    const idValidation = uuidSchema.safeParse(body.assetcategorytypeid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid asset category ID" },
        { status: 400 }
      );
    }

    // Validate update data
    const dataValidation = updateAssetCategoryTypeSchema.safeParse(body);
    if (!dataValidation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: dataValidation.error.issues,
        },
        { status: 400 }
      );
    }

    const { assetcategorytypeid, assetcategorytypename } = body;

    const updated = await prisma.assetCategoryType.update({
      where: { assetcategorytypeid },
      data: {
        assetcategorytypename,
      },
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.ASSET_CATEGORY,
      entityId: updated.assetcategorytypeid,
      details: { assetcategorytypename },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error("PUT /api/assetCategory error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Asset category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update asset category" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
