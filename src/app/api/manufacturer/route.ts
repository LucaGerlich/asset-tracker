import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { Prisma } from "@prisma/client";
import { requireApiAuth, requireApiAdmin } from "@/lib/api-auth";
import { createManufacturerSchema, updateManufacturerSchema, uuidSchema } from "@/lib/validation";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";

const MANUFACTURER_SORT_FIELDS = ["manufacturername", "creation_date"];

// GET /api/manufacturer
export async function GET(req) {
  try {
    // Require authentication to view manufacturers
    await requireApiAuth();

    const searchParams = req.nextUrl.searchParams;

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const items = await prisma.manufacturer.findMany({
        orderBy: { manufacturername: "asc" },
      });
      return NextResponse.json(items, { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, MANUFACTURER_SORT_FIELDS);

    const where: Record<string, unknown> = {};

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

    return NextResponse.json(
      buildPaginatedResponse(items, total, params),
      { status: 200 },
    );
  } catch (e) {
    console.error("GET /api/manufacturer error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch manufacturers" },
      { status: 500 }
    );
  }
}

// POST /api/manufacturer
export async function POST(req) {
  try {
    // Only admins can create manufacturers
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate input
    const validationResult = createManufacturerSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { manufacturername } = validationResult.data;

    const created = await prisma.manufacturer.create({
      data: {
        manufacturername,
        creation_date: new Date(),
      } as Prisma.manufacturerUncheckedCreateInput,
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.MANUFACTURER,
      entityId: created.manufacturerid,
      details: { manufacturername },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("POST /api/manufacturer error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create manufacturer" },
      { status: 500 }
    );
  }
}

// PUT /api/manufacturer
export async function PUT(req) {
  try {
    // Only admins can update manufacturers
    const admin = await requireApiAdmin();

    const body = await req.json();

    // Validate manufacturer ID
    const idValidation = uuidSchema.safeParse(body.manufacturerid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid manufacturer ID" },
        { status: 400 }
      );
    }

    // Validate update data
    const dataValidation = updateManufacturerSchema.safeParse(body);
    if (!dataValidation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: dataValidation.error.issues,
        },
        { status: 400 }
      );
    }

    const { manufacturerid, manufacturername } = body;

    const updated = await prisma.manufacturer.update({
      where: { manufacturerid },
      data: {
        manufacturername,
        change_date: new Date(),
      },
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.MANUFACTURER,
      entityId: updated.manufacturerid,
      details: { manufacturername },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    console.error("PUT /api/manufacturer error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Manufacturer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update manufacturer" },
      { status: 500 }
    );
  }
}

// DELETE /api/manufacturer
export async function DELETE(req) {
  try {
    // Only admins can delete manufacturers
    const admin = await requireApiAdmin();

    const body = await req.json();
    const { manufacturerid } = body;

    // Validate manufacturer ID
    const idValidation = uuidSchema.safeParse(manufacturerid);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: "Invalid manufacturer ID" },
        { status: 400 }
      );
    }

    // Get manufacturer details before deletion for audit log
    const manufacturer = await prisma.manufacturer.findUnique({
      where: { manufacturerid },
      select: { manufacturername: true },
    });

    if (!manufacturer) {
      return NextResponse.json(
        { error: "Manufacturer not found" },
        { status: 404 }
      );
    }

    // Delete the manufacturer
    await prisma.manufacturer.delete({
      where: { manufacturerid },
    });

    // Create audit log
    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.DELETE,
      entity: AUDIT_ENTITIES.MANUFACTURER,
      entityId: manufacturerid,
      details: { manufacturername: manufacturer.manufacturername },
    });

    return NextResponse.json(
      { message: "Manufacturer deleted successfully" },
      { status: 200 }
    );
  } catch (e) {
    console.error("DELETE /api/manufacturer error:", e);

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Manufacturer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete manufacturer" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";

