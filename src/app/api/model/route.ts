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
import { invalidateCache } from "@/lib/cache";
import { getOrganizationContext } from "@/lib/organization-context";

const MODEL_SORT_FIELDS = ["modelname", "modelnumber", "creation_date"];

export async function GET(req: NextRequest) {
  try {
    // Require authentication to view models
    await requireApiAuth();

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const searchParams = req.nextUrl.searchParams;

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const items = await prisma.model.findMany({
        where: { organizationId: orgId ?? null },
        orderBy: { modelname: "asc" },
      });
      return NextResponse.json(items, { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, MODEL_SORT_FIELDS);

    const where: Record<string, unknown> = { organizationId: orgId ?? null };

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

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const created = await prisma.model.create({
      data: {
        modelname,
        modelnumber: modelnumber || null,
        creation_date: new Date(),
        organizationId: orgId ?? null,
      } as Prisma.modelUncheckedCreateInput,
    });

    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.MODEL,
      entityId: created.modelid,
      details: { modelname, modelnumber },
    });

    invalidateCache("models").catch(() => {});
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

    const idValidation = uuidSchema.safeParse(body.modelid);
    if (!idValidation.success) {
      return NextResponse.json({ error: "Invalid model ID" }, { status: 400 });
    }

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

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    // Verify ownership before update
    const existing = await prisma.model.findFirst({
      where: { modelid, organizationId: orgId ?? null },
    });
    if (!existing) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    const updated = await prisma.model.update({
      where: { modelid },
      data: {
        modelname,
        modelnumber: modelnumber || null,
        change_date: new Date(),
      },
    });

    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.MODEL,
      entityId: updated.modelid,
      details: { modelname, modelnumber },
    });

    invalidateCache("models").catch(() => {});
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

export async function DELETE(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    // Only admins can delete models
    const admin = await requireApiAdmin();

    const body = await req.json();
    const { modelid } = body;

    const idValidation = uuidSchema.safeParse(modelid);
    if (!idValidation.success) {
      return NextResponse.json({ error: "Invalid model ID" }, { status: 400 });
    }

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    // Verify ownership before deletion
    const model = await prisma.model.findFirst({
      where: { modelid, organizationId: orgId ?? null },
      select: { modelname: true },
    });

    if (!model) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    const [assetRefs, accessoriesRefs] = await Promise.all([
      prisma.asset.count({ where: { modelid } }),
      prisma.accessories.count({ where: { modelid } }),
    ]);
    const totalRefs = assetRefs + accessoriesRefs;
    if (totalRefs > 0) {
      const details = [
        assetRefs > 0 && `${assetRefs} asset(s)`,
        accessoriesRefs > 0 && `${accessoriesRefs} accessory/ies`,
      ]
        .filter(Boolean)
        .join(", ");
      return NextResponse.json(
        { error: `Cannot delete: ${details} still reference this model` },
        { status: 409 },
      );
    }

    await prisma.model.delete({
      where: { modelid },
    });

    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.DELETE,
      entity: AUDIT_ENTITIES.MODEL,
      entityId: modelid,
      details: { modelname: model.modelname },
    });

    invalidateCache("models").catch(() => {});
    return NextResponse.json(
      { message: "Model deleted successfully" },
      { status: 200 },
    );
  } catch (e) {
    logger.error("DELETE /api/model error", { error: e });

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
      { error: "Failed to delete model" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
