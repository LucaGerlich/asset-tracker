import { NextRequest, NextResponse } from "next/server";
import {
  requireApiAuth,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { getOrgStorage } from "@/lib/storage";
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

    const { id } = await params;

    // A caller without an organization owns no attachments: never drop the
    // filter, it would let the delete reach any tenant's file.
    const orgId = user.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 },
      );
    }

    const attachment = await prisma.asset_attachments.findFirst({
      where: { id, asset: { organizationId: orgId } },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 },
      );
    }

    const storage = await getOrgStorage(orgId);
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

    const { id } = await params;
    const body = await req.json();
    const { isPrimary } = body;

    const orgId = user.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 },
      );
    }

    const attachment = await prisma.asset_attachments.findFirst({
      where: { id, asset: { organizationId: orgId } },
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
