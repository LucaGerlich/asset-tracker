import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, requireNotDemoMode } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { unlink } from "fs/promises";
import { join } from "path";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const { id } = await params;

    const attachment = await prisma.asset_attachments.findFirst({
      where: {
        id,
        ...(orgId ? { asset: { organizationId: orgId } } : {}),
      },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 },
      );
    }

    try {
      const filePath = join(process.cwd(), "public", attachment.path);
      await unlink(filePath);
    } catch {
      // File may already be deleted from disk, continue with DB cleanup
    }

    await prisma.asset_attachments.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to delete attachment" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    await requireApiAuth();
    const orgCtx2 = await getOrganizationContext();
    const orgId2 = orgCtx2?.organization?.id;

    const { id } = await params;
    const body = await req.json();
    const { isPrimary } = body;

    const attachment = await prisma.asset_attachments.findFirst({
      where: {
        id,
        ...(orgId2 ? { asset: { organizationId: orgId2 } } : {}),
      },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 },
      );
    }

    if (isPrimary) {
      await prisma.asset_attachments.updateMany({
        where: { assetId: attachment.assetId },
        data: { isPrimary: false },
      });
    }

    const updated = await prisma.asset_attachments.update({
      where: { id },
      data: { isPrimary },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to update attachment" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
