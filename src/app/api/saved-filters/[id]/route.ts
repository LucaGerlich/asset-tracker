import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth, requireWritableOrg } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/saved-filters/[id]
export async function PUT(req: Request, { params }: RouteParams) {
  try {
    const user = await requireApiAuth();
    await requireWritableOrg(user);
    const { id } = await params;
    const body = await req.json();
    const { name, filters, isDefault, isGlobal } = body;

    // Verify ownership
    const existing = await prisma.saved_filters.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.saved_filters.updateMany({
        where: {
          userId: user.id!,
          entity: existing.entity,
          isDefault: true,
          NOT: { id },
        },
        data: { isDefault: false, updatedAt: new Date() },
      });
    }

    const updated = await prisma.saved_filters.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(filters !== undefined && {
          filters:
            typeof filters === "string" ? filters : JSON.stringify(filters),
        }),
        ...(isDefault !== undefined && { isDefault }),
        ...(isGlobal !== undefined && { isGlobal }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("PUT /api/saved-filters/[id] error", { error });
    return NextResponse.json(
      { error: "Failed to update filter" },
      { status: 500 },
    );
  }
}

// DELETE /api/saved-filters/[id]
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const user = await requireApiAuth();
    await requireWritableOrg(user);
    const { id } = await params;

    const existing = await prisma.saved_filters.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.saved_filters.delete({ where: { id } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("DELETE /api/saved-filters/[id] error", { error });
    return NextResponse.json(
      { error: "Failed to delete filter" },
      { status: 500 },
    );
  }
}
