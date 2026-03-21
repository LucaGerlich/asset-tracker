import { type NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { Prisma } from "@prisma/client";
import {
  requireApiAuth,
  requireApiAdmin,
  requireNotDemoMode,
} from "@/lib/api-auth";
import {
  createModelSchema,
  updateModelSchema,
  uuidSchema,
} from "@/lib/validation";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { logger } from "@/lib/logger";

const MODEL_SORT_FIELDS = ["modelname", "modelnumber", "creation_date"];

// GET /api/model
export async function GET(req: NextRequest) {
  try {
    // Require authentication to view models
    await requireApiAuth();

    const searchParams = req.nextUrl.searchParams;

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const items = await prisma.model.findMany({
        orderBy: { modelname: "asc" },
      });
      return NextResponse.json(items, { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, MODEL_SORT_FIELDS);

    const where: Record<string, unknown> = {};

    // Search filter
    if (params.search) {
      where.OR = [
        { modelname: { contains: params.search, mode: "insensitive" } },
        { modelnumber: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.model.findMany({ where, ...prismaArgs }),
      prisma.model.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedResponse(items, total, params), {
      status: 200,
    });
  } catch (e) {
    logger.error("GET /api/model error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch models" },
      { status: 500 },
    );
  }
}

// POST /api/model
export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    // Only admins can create models
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate input
    const validationResult = createModelSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 },
      );
    }

    const { modelname, modelnumber } = validationResult.data;

    const created = await prisma.model.create({
      data: {
        modelname,
        modelnumber: modelnumber || null,
        creation_date: new Date(),
      } as Prisma.modelUncheckedCreateInput,
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.MODEL,
      entityId: created.modelid,
      details: { modelname, modelnumber },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    logger.error("POST /api/model error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create model" },
      { status: 500 },
    );
  }
}

// PUT /api/model
export async function PUT(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    // Only admins can update models
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate model ID
    const idValidation = uuidSchema.safeParse(body.modelid);
    if (!idValidation.success) {
      return NextResponse.json({ error: "Invalid model ID" }, { status: 400 });
    }

    // Validate update data
    const dataValidation = updateModelSchema.safeParse(body);
    if (!dataValidation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: dataValidation.error.issues,
        },
        { status: 400 },
      );
    }

    const { modelid, modelname, modelnumber } = body;

    const updated = await prisma.model.update({
      where: { modelid },
      data: {
        modelname,
        modelnumber: modelnumber || null,
        change_date: new Date(),
      },
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.MODEL,
      entityId: updated.modelid,
      details: { modelname, modelnumber },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    logger.error("PUT /api/model error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to update model" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
