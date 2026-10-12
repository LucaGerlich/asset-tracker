import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/admin/labels/[id]
export async function PUT(req: Request, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAdmin();
    await requireWritableOrg(user);
    const { id } = await params;
    const body = await req.json();
    const {
      name,
      width,
      height,
      layout,
      includeQR,
      includeLogo,
      fields,
      isDefault,
    } = body;

    if (isDefault) {
      await prisma.label_templates.updateMany({
        where: { isDefault: true, NOT: { id } },
        data: { isDefault: false, updatedAt: new Date() },
      });
    }

    const template = await prisma.label_templates.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(width !== undefined && { width }),
        ...(height !== undefined && { height }),
        ...(layout !== undefined && { layout }),
        ...(includeQR !== undefined && { includeQR }),
        ...(includeLogo !== undefined && { includeLogo }),
        ...(fields !== undefined && {
          fields: typeof fields === "string" ? fields : JSON.stringify(fields),
        }),
        ...(isDefault !== undefined && { isDefault }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(template, { status: 200 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("PUT /api/admin/labels/[id] error", { error });
    return NextResponse.json(
      { error: "Failed to update label template" },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/labels/[id]
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAdmin();
    await requireWritableOrg(user);
    const { id } = await params;

    await prisma.label_templates.delete({ where: { id } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("DELETE /api/admin/labels/[id] error", { error });
    return NextResponse.json(
      { error: "Failed to delete label template" },
      { status: 500 },
    );
  }
}
