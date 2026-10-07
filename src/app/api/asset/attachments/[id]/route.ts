import { NextRequest, NextResponse } from "next/server";
import {
  requireApiAuth,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { getOrganizationContext } from "@/lib/organization-context";
import { getStorage, getOrgStorage } from "@/lib/storage";
import { deleteThumbnails } from "@/lib/storage/thumbnails";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const user = await requireApiAuth();
    await requireWritableOrg(user);
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

    const storage = orgId ? await getOrgStorage(orgId) : await getStorage();
    try {
      await storage.delete(attachment.filename);
      if (attachment.thumbnailPath) {
        const uuid = attachment.filename.replace(/\.[^.]+$/, "");
        await deleteThumbnails(storage, uuid);
      }
    } catch {
      // File may already be deleted from storage, continue with DB cleanup
    }

    await prisma.asset_attachments.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
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
    const user = await requireApiAuth();
    await requireWritableOrg(user);
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
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    return NextResponse.json(
      { error: "Failed to update attachment" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
