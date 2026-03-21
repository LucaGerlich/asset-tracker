import { type NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import {
  requireApiAuth,
  requireApiAdmin,
  requireNotDemoMode,
} from "@/lib/api-auth";
import {
  createStatusTypeSchema,
  updateStatusTypeSchema,
  uuidSchema,
} from "@/lib/validation";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { cached, invalidateCache } from "@/lib/cache";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { logger } from "@/lib/logger";

const STATUS_TYPE_SORT_FIELDS = ["statustypename"];

// GET /api/statusType
export async function GET(req: NextRequest) {
  try {
    // Require authentication to view status types
    await requireApiAuth();

    const searchParams = req.nextUrl.searchParams;

    // If no `page` param, return all results (cached) for backward compatibility
    if (!searchParams.has("page")) {
      const items = await cached(
        "status_types",
        () =>
          prisma.statusType.findMany({ orderBy: { statustypename: "asc" } }),
        5 * 60 * 1000,
      );
      return NextResponse.json(items, { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, STATUS_TYPE_SORT_FIELDS);

    const where: Record<string, unknown> = {};

    // Search filter
    if (params.search) {
      where.OR = [
        { statustypename: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.statusType.findMany({ where, ...prismaArgs }),
      prisma.statusType.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedResponse(items, total, params), {
      status: 200,
    });
  } catch (e) {
    logger.error("GET /api/statusType error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch status types" },
      { status: 500 },
    );
  }
}

// POST /api/statusType
export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    // Only admins can create status types
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate input
    const validationResult = createStatusTypeSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 },
      );
    }

    const { statustypename } = validationResult.data;

    const created = await prisma.statusType.create({
      data: {
        statustypename,
      },
    });

    // Invalidate cached status types so subsequent reads reflect the new entry
    await invalidateCache("status_types");

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.STATUS_TYPE,
      entityId: created.statustypeid,
      details: { statustypename },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    logger.error("POST /api/statusType error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create status type" },
      { status: 500 },
    );
  }
}

// PUT /api/statusType
export async function PUT(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    // Only admins can update status types
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate status ID
    const idValidation = uuidSchema.safeParse(body.statustypeid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid status type ID" },
        { status: 400 },
      );
    }

    // Validate update data
    const dataValidation = updateStatusTypeSchema.safeParse(body);
    if (!dataValidation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: dataValidation.error.issues,
        },
        { status: 400 },
      );
    }

    const { statustypeid, statustypename } = body;

    const updated = await prisma.statusType.update({
      where: { statustypeid },
      data: {
        statustypename,
      },
    });

    // Invalidate cached status types so subsequent reads reflect the update
    await invalidateCache("status_types");

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.STATUS_TYPE,
      entityId: updated.statustypeid,
      details: { statustypename },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    logger.error("PUT /api/statusType error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Status type not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update status type" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
