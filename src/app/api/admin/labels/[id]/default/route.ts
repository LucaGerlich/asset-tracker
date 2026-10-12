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

// POST /api/admin/labels/[id]/default
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAdmin();
    await requireWritableOrg(user);
    const { id } = await params;

    await prisma.label_templates.updateMany({
      where: { isDefault: true },
      data: { isDefault: false, updatedAt: new Date() },
    });

    // Set new default
    const template = await prisma.label_templates.update({
      where: { id },
      data: { isDefault: true, updatedAt: new Date() },
    });

    return NextResponse.json(template, { status: 200 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("POST /api/admin/labels/[id]/default error", { error });
    return NextResponse.json(
      { error: "Failed to set default template" },
      { status: 500 },
    );
  }
}
