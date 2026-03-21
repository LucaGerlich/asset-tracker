import { type NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { Prisma } from "@prisma/client";
import {
  requireApiAuth,
  requireApiAdmin,
  requireNotDemoMode,
} from "@/lib/api-auth";
import {
  createLocationSchema,
  updateLocationSchema,
  uuidSchema,
} from "@/lib/validation";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { logger } from "@/lib/logger";

const LOCATION_SORT_FIELDS = ["locationname", "creation_date"];

// GET /api/location
export async function GET(req: NextRequest) {
  try {
    // Require authentication to view locations
    await requireApiAuth();

    const searchParams = req.nextUrl.searchParams;

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const items = await prisma.location.findMany({
        orderBy: { locationname: "asc" },
      });
      return NextResponse.json(items, { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, LOCATION_SORT_FIELDS);

    const where: Record<string, unknown> = {};

    // Search filter
    if (params.search) {
      where.OR = [
        { locationname: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.location.findMany({ where, ...prismaArgs }),
      prisma.location.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedResponse(items, total, params), {
      status: 200,
    });
  } catch (e) {
    logger.error("GET /api/location error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch locations" },
      { status: 500 },
    );
  }
}

// POST /api/location
export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    // Only admins can create locations
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate input
    const validationResult = createLocationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 },
      );
    }

    const { locationname, street, housenumber, city, country } =
      validationResult.data;

    const created = await prisma.location.create({
      data: {
        locationname,
        street: street ?? null,
        housenumber: housenumber ?? null,
        city: city ?? null,
        country: country ?? null,
        creation_date: new Date(),
      } as Prisma.locationUncheckedCreateInput,
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.LOCATION,
      entityId: created.locationid,
      details: { locationname },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    logger.error("POST /api/location error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create location" },
      { status: 500 },
    );
  }
}

// PUT /api/location
export async function PUT(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    // Only admins can update locations
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate location ID
    const idValidation = uuidSchema.safeParse(body.locationid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid location ID" },
        { status: 400 },
      );
    }

    // Validate update data
    const dataValidation = updateLocationSchema.safeParse(body);
    if (!dataValidation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: dataValidation.error.issues,
        },
        { status: 400 },
      );
    }

    const { locationid, locationname, street, housenumber, city, country } =
      body;

    const updated = await prisma.location.update({
      where: { locationid },
      data: {
        ...(locationname !== undefined && { locationname }),
        ...(street !== undefined && { street: street ?? null }),
        ...(housenumber !== undefined && { housenumber: housenumber ?? null }),
        ...(city !== undefined && { city: city ?? null }),
        ...(country !== undefined && { country: country ?? null }),
        change_date: new Date(),
      },
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.LOCATION,
      entityId: updated.locationid,
      details: { locationname: updated.locationname },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    logger.error("PUT /api/location error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update location" },
      { status: 500 },
    );
  }
}

// DELETE /api/location
export async function DELETE(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    // Only admins can delete locations
    const admin = await requireApiAdmin();

    const body = await req.json();
    const { locationid } = body;

    // Validate location ID
    const idValidation = uuidSchema.safeParse(locationid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid location ID" },
        { status: 400 },
      );
    }

    // Get location details before deletion for audit log
    const location = await prisma.location.findUnique({
      where: { locationid },
      select: { locationname: true },
    });

    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      );
    }

    // Delete the location
    await prisma.location.delete({
      where: { locationid },
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.DELETE,
      entity: AUDIT_ENTITIES.LOCATION,
      entityId: locationid,
      details: { locationname: location.locationname },
    });

    return NextResponse.json(
      { message: "Location deleted successfully" },
      { status: 200 },
    );
  } catch (e) {
    logger.error("DELETE /api/location error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to delete location" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
