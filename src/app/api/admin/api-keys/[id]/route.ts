import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAdmin, requireNotDemoMode } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

// DELETE /api/admin/api-keys/[id] - Revoke (deactivate) an API key
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAdmin();
    const { id } = await params;

    // Ensure the key belongs to the authenticated user
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id,
        userId: user.id!,
      },
    });

    if (!apiKey) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    await prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(
      { message: "API key revoked successfully" },
      { status: 200 },
    );
  } catch (error) {
    logger.error("DELETE /api/admin/api-keys/[id] error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to revoke API key" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
