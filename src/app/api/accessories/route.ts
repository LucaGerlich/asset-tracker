import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { createAccessorySchema } from "@/lib/validation";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { logger } from "@/lib/logger";

const ACCESSORY_SORT_FIELDS = ["accessoriename", "creation_date"];

const accessorySchema = createAccessorySchema
  .extend({
    purchaseprice: z.number().nonnegative().nullable().optional(),
  })
  .strict();

const updateSchema = accessorySchema.partial().strict();

const normalizeDateInput = (value: unknown) => {
  if (value === null || value === undefined) return value;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00.000Z`;
  }
  return trimmed;
};

const normalizeNumberInput = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value === "number") return value;
  const num = Number(value);
  return Number.isNaN(num) ? value : num;
};

// GET /api/accessories
// Pagination: ?page=1&pageSize=25&sortBy=accessoriename&sortOrder=asc&search=keyword
export async function GET(req) {
  try {
    await requirePermission("accessory:view");
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const searchParams = req.nextUrl.searchParams;

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const where = scopeToOrganization({}, orgId);
      const items = await prisma.accessories.findMany({
        where,
        select: {
          accessorieid: true,
          accessoriename: true,
          accessorietag: true,
          manufacturerid: true,
          statustypeid: true,
          accessoriecategorytypeid: true,
          locationid: true,
          supplierid: true,
          modelid: true,
          purchaseprice: true,
          purchasedate: true,
          requestable: true,
          creation_date: true,
          change_date: true,
        },
      });
      return NextResponse.json(items, { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, ACCESSORY_SORT_FIELDS);

    const where: Record<string, unknown> = scopeToOrganization({}, orgId);

    // Search filter (accessoriename)
    if (params.search) {
      where.accessoriename = { contains: params.search, mode: "insensitive" };
    }

    const [items, total] = await Promise.all([
      prisma.accessories.findMany({ where, ...prismaArgs }),
      prisma.accessories.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedResponse(items, total, params), {
      status: 200,
    });
  } catch (e) {
    logger.error("GET /api/accessories error", { error: e });
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof Error && e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch accessories" },
      { status: 500 },
    );
  }
}

// POST /api/accessories
export async function POST(req) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    await requirePermission("accessory:create");
    const body = await req.json();
    const normalized = {
      ...body,
      purchaseprice: normalizeNumberInput(body?.purchaseprice),
      purchasedate: normalizeDateInput(body?.purchasedate),
    };

    const validationResult = accessorySchema.safeParse(normalized);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.issues },
        { status: 400 },
      );
    }

    const {
      accessoriename,
      accessorietag,
      manufacturerid,
      statustypeid,
      accessoriecategorytypeid,
      locationid,
      supplierid,
      modelid,
      purchaseprice,
      purchasedate,
      requestable,
    } = validationResult.data;

    const created = await prisma.accessories.create({
      data: {
        accessoriename,
        accessorietag,
        manufacturerid,
        statustypeid,
        accessoriecategorytypeid,
        locationid,
        supplierid,
        modelid,
        purchaseprice: purchaseprice ?? null,
        purchasedate: purchasedate ? new Date(purchasedate) : null,
        requestable: typeof requestable === "boolean" ? requestable : null,
        creation_date: new Date(),
      } as Prisma.accessoriesUncheckedCreateInput,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    logger.error("POST /api/accessories error", { error: e });
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof Error && e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to create accessory" },
      { status: 500 },
    );
  }
}

// PUT /api/accessories
export async function PUT(req) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    await requirePermission("accessory:edit");
    const body = await req.json();
    const { accessorieid, ...data } = body || {};

    if (!accessorieid) {
      return NextResponse.json(
        { error: "accessorieid is required" },
        { status: 400 },
      );
    }

    const normalized = {
      ...data,
      purchaseprice: normalizeNumberInput(data?.purchaseprice),
      purchasedate: normalizeDateInput(data?.purchasedate),
    };

    const validationResult = updateSchema.safeParse(normalized);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.issues },
        { status: 400 },
      );
    }

    const updateData = { ...validationResult.data } as Record<string, unknown>;
    if (
      Object.prototype.hasOwnProperty.call(updateData, "purchasedate") &&
      updateData.purchasedate
    ) {
      updateData.purchasedate = new Date(updateData.purchasedate as string);
    }

    const updated = await prisma.accessories.update({
      where: { accessorieid },
      data: {
        ...updateData,
        change_date: new Date(),
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    logger.error("PUT /api/accessories error", { error: e });
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e instanceof Error && e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to update accessory" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
