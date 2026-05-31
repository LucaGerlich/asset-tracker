import { type NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { Prisma } from "@prisma/client";
import {
  requireApiAuth,
  requireApiAdmin,
  requireNotDemoMode,
} from "@/lib/api-auth";
import {
  createManufacturerSchema,
  updateManufacturerSchema,
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

const MANUFACTURER_SORT_FIELDS = ["manufacturername", "creation_date"];

export async function GET(req: NextRequest) {
  try {
    // Require authentication to view manufacturers
    await requireApiAuth();

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const searchParams = req.nextUrl.searchParams;

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const items = await prisma.manufacturer.findMany({
        where: { organizationId: orgId ?? null },
        orderBy: { manufacturername: "asc" },
      });
      return NextResponse.json(items, { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, MANUFACTURER_SORT_FIELDS);

    const where: Record<string, unknown> = { organizationId: orgId ?? null };

    // Search filter
    if (params.search) {
      where.OR = [
        { manufacturername: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.manufacturer.findMany({ where, ...prismaArgs }),
      prisma.manufacturer.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedResponse(items, total, params), {
      status: 200,
    });
  } catch (e) {
    logger.error("GET /api/manufacturer error", { error: e });

    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch manufacturers" },
      { status: 500 },
    );
  }
}

// POST /api/manufacturer
export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    // Only admins can create manufacturers
    const admin = await requireApiAdmin();

    const body = await req.json();

    const validationResult = createManufacturerSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 },
      );
    }

    const { manufacturername } = validationResult.data;

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const created = await prisma.manufacturer.create({
      data: {
        manufacturername,
        creation_date: new Date(),
        organizationId: orgId ?? null,
      } as Prisma.manufacturerUncheckedCreateInput,
    });

    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.MANUFACTURER,
      entityId: created.manufacturerid,
      details: { manufacturername },
    });

    invalidateCache("manufacturers").catch(() => {});
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    logger.error("POST /api/manufacturer error", { error: e });

    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof Error && e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create manufacturer" },
      { status: 500 },
    );
  }
}

// PUT /api/manufacturer
export async function PUT(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    // Only admins can update manufacturers
    const admin = await requireApiAdmin();

    const body = await req.json();

    const idValidation = uuidSchema.safeParse(body.manufacturerid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid manufacturer ID" },
        { status: 400 },
      );
    }

    const dataValidation = updateManufacturerSchema.safeParse(body);
    if (!dataValidation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: dataValidation.error.issues,
        },
        { status: 400 },
      );
    }

    const { manufacturerid, manufacturername } = body;

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    // Verify ownership before update
    const existing = await prisma.manufacturer.findFirst({
      where: { manufacturerid, organizationId: orgId ?? null },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Manufacturer not found" },
        { status: 404 },
      );
    }

    const updated = await prisma.manufacturer.update({
      where: { manufacturerid },
      data: {
        manufacturername,
        change_date: new Date(),
      },
    });

    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.MANUFACTURER,
      entityId: updated.manufacturerid,
      details: { manufacturername },
    });

    invalidateCache("manufacturers").catch(() => {});
    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    logger.error("PUT /api/manufacturer error", { error: e });

    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof Error && e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Manufacturer not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update manufacturer" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    // Only admins can delete manufacturers
    const admin = await requireApiAdmin();

    const body = await req.json();
    const { manufacturerid } = body;

    const idValidation = uuidSchema.safeParse(manufacturerid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid manufacturer ID" },
        { status: 400 },
      );
    }

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    // Verify ownership before deletion
    const manufacturer = await prisma.manufacturer.findFirst({
      where: { manufacturerid, organizationId: orgId ?? null },
      select: { manufacturername: true },
    });

    if (!manufacturer) {
      return NextResponse.json(
        { error: "Manufacturer not found" },
        { status: 404 },
      );
    }

    const [
      assetRefs,
      accessoriesRefs,
      consumableRefs,
      licenceRefs,
      componentRefs,
    ] = await Promise.all([
      prisma.asset.count({ where: { manufacturerid } }),
      prisma.accessories.count({ where: { manufacturerid } }),
      prisma.consumable.count({ where: { manufacturerid } }),
      prisma.licence.count({ where: { manufacturerid } }),
      prisma.component.count({ where: { manufacturerId: manufacturerid } }),
    ]);
    const totalRefs =
      assetRefs +
      accessoriesRefs +
      consumableRefs +
      licenceRefs +
      componentRefs;
    if (totalRefs > 0) {
      const details = [
        assetRefs > 0 && `${assetRefs} asset(s)`,
        accessoriesRefs > 0 && `${accessoriesRefs} accessory/ies`,
        consumableRefs > 0 && `${consumableRefs} consumable(s)`,
        licenceRefs > 0 && `${licenceRefs} licence(s)`,
        componentRefs > 0 && `${componentRefs} component(s)`,
      ]
        .filter(Boolean)
        .join(", ");
      return NextResponse.json(
        {
          error: `Cannot delete: ${details} still reference this manufacturer`,
        },
        { status: 409 },
      );
    }

    await prisma.manufacturer.delete({
      where: { manufacturerid },
    });

    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.DELETE,
      entity: AUDIT_ENTITIES.MANUFACTURER,
      entityId: manufacturerid,
      details: { manufacturername: manufacturer.manufacturername },
    });

    invalidateCache("manufacturers").catch(() => {});
    return NextResponse.json(
      { message: "Manufacturer deleted successfully" },
      { status: 200 },
    );
  } catch (e) {
    logger.error("DELETE /api/manufacturer error", { error: e });

    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof Error && e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Manufacturer not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to delete manufacturer" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
