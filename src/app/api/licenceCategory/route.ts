import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { Prisma } from "@prisma/client";
import { requireApiAuth, requireApiAdmin } from "@/lib/api-auth";
import { createLicenceCategoryTypeSchema, updateLicenceCategoryTypeSchema, uuidSchema } from "@/lib/validation";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";

const LICENCE_CATEGORY_SORT_FIELDS = ["licencecategorytypename"];

// GET /api/licenceCategory
export async function GET(req) {
  try {
    // Require authentication to view licence categories
    await requireApiAuth();

    const searchParams = req.nextUrl.searchParams;

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const items = await prisma.licenceCategoryType.findMany({
        orderBy: { licencecategorytypename: "asc" },
      });
      return NextResponse.json(items, { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, LICENCE_CATEGORY_SORT_FIELDS);

    const where: Record<string, unknown> = {};

    // Search filter
    if (params.search) {
      where.OR = [
        { licencecategorytypename: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.licenceCategoryType.findMany({ where, ...prismaArgs }),
      prisma.licenceCategoryType.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginatedResponse(items, total, params),
      { status: 200 },
    );
  } catch (e) {
    console.error("GET /api/licenceCategory error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch licence categories" },
      { status: 500 }
    );
  }
}

// POST /api/licenceCategory
export async function POST(req) {
  try {
    // Only admins can create licence categories
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate input
    const validationResult = createLicenceCategoryTypeSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { licencecategorytypename } = validationResult.data;

    const created = await prisma.licenceCategoryType.create({
      data: {
        licencecategorytypename,
      } as Prisma.licenceCategoryTypeUncheckedCreateInput,
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.LICENCE_CATEGORY,
      entityId: created.licencecategorytypeid,
      details: { licencecategorytypename },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("POST /api/licenceCategory error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create licence category" },
      { status: 500 }
    );
  }
}

// PUT /api/licenceCategory
export async function PUT(req) {
  try {
    // Only admins can update licence categories
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate category ID
    const idValidation = uuidSchema.safeParse(body.licencecategorytypeid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid licence category ID" },
        { status: 400 }
      );
    }

    // Validate update data
    const dataValidation = updateLicenceCategoryTypeSchema.safeParse(body);
    if (!dataValidation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: dataValidation.error.issues,
        },
        { status: 400 }
      );
    }

    const { licencecategorytypeid, licencecategorytypename } = body;

    const updated = await prisma.licenceCategoryType.update({
      where: { licencecategorytypeid },
      data: {
        licencecategorytypename,
      },
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.LICENCE_CATEGORY,
      entityId: updated.licencecategorytypeid,
      details: { licencecategorytypename },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error("PUT /api/licenceCategory error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Licence category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update licence category" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
