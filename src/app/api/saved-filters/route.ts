import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth, requireWritableOrg } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

// GET /api/saved-filters?entity=asset
export async function GET(req: Request) {
  try {
    const user = await requireApiAuth();
    const url = new URL(req.url);
    const entity = url.searchParams.get("entity");

    if (!entity) {
      return NextResponse.json(
        { error: "entity query parameter is required" },
        { status: 400 },
      );
    }

    const filters = await prisma.saved_filters.findMany({
      where: {
        entity,
        OR: [{ userId: user.id! }, { isGlobal: true }],
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    return NextResponse.json(filters, { status: 200 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("GET /api/saved-filters error", { error });
    return NextResponse.json(
      { error: "Failed to fetch saved filters" },
      { status: 500 },
    );
  }
}

// POST /api/saved-filters
export async function POST(req: Request) {
  try {
    const user = await requireApiAuth();
    await requireWritableOrg(user);
    const body = await req.json();
    const { name, entity, filters, isDefault, isGlobal } = body;

    if (!name || !entity || !filters) {
      return NextResponse.json(
        { error: "name, entity, and filters are required" },
        { status: 400 },
      );
    }

    // If setting as default, unset other defaults for this entity/user
    if (isDefault) {
      await prisma.saved_filters.updateMany({
        where: { userId: user.id!, entity, isDefault: true },
        data: { isDefault: false, updatedAt: new Date() },
      });
    }

    const filter = await prisma.saved_filters.create({
      data: {
        userId: user.id!,
        name,
        entity,
        filters:
          typeof filters === "string" ? filters : JSON.stringify(filters),
        isDefault: isDefault || false,
        isGlobal: isGlobal || false,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(filter, { status: 201 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("POST /api/saved-filters error", { error });
    return NextResponse.json(
      { error: "Failed to save filter" },
      { status: 500 },
    );
  }
}
