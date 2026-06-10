import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, requireNotDemoMode } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { getOrganizationContext } from "@/lib/organization-context";
import { getOrgStorage } from "@/lib/storage";
import { deleteThumbnails } from "@/lib/storage/thumbnails";

type EntityType = "accessory" | "consumable" | "component";

type AttachmentRecord = {
  id: string;
  filename: string;
  thumbnailPath: string | null;
  isPrimary: boolean;
  entityId: string;
};

const VALID_ENTITY_TYPES = new Set<EntityType>([
  "accessory",
  "consumable",
  "component",
]);

async function findAttachment(
  id: string,
  entityType: EntityType,
  orgId: string | undefined,
): Promise<AttachmentRecord | null> {
  switch (entityType) {
    case "accessory": {
      const att = await prisma.accessory_attachments.findFirst({
        where: {
          id,
          ...(orgId ? { accessory: { organizationId: orgId } } : {}),
        },
      });
      return att
        ? {
            id: att.id,
            filename: att.filename,
            thumbnailPath: att.thumbnailPath,
            isPrimary: att.isPrimary,
            entityId: att.accessoryId,
          }
        : null;
    }
    case "consumable": {
      const att = await prisma.consumable_attachments.findFirst({
        where: {
          id,
          ...(orgId ? { consumable: { organizationId: orgId } } : {}),
        },
      });
      return att
        ? {
            id: att.id,
            filename: att.filename,
            thumbnailPath: att.thumbnailPath,
            isPrimary: att.isPrimary,
            entityId: att.consumableId,
          }
        : null;
    }
    case "component": {
      const att = await prisma.component_attachments.findFirst({
        where: {
          id,
          ...(orgId ? { component: { organizationId: orgId } } : {}),
        },
      });
      return att
        ? {
            id: att.id,
            filename: att.filename,
            thumbnailPath: att.thumbnailPath,
            isPrimary: att.isPrimary,
            entityId: att.componentId,
          }
        : null;
    }
  }
}

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
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType") as EntityType | null;

    if (!entityType || !VALID_ENTITY_TYPES.has(entityType)) {
      return NextResponse.json(
        { error: "entityType query param is required" },
        { status: 400 },
      );
    }

    const attachment = await findAttachment(id, entityType, orgId);
    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 },
      );
    }

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 400 },
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
      // File may already be deleted from storage; continue with DB cleanup
    }

    switch (entityType) {
      case "accessory":
        await prisma.accessory_attachments.delete({ where: { id } });
        break;
      case "consumable":
        await prisma.consumable_attachments.delete({ where: { id } });
        break;
      case "component":
        await prisma.component_attachments.delete({ where: { id } });
        break;
    }

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
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const { id } = await params;
    const body = (await req.json()) as {
      isPrimary: boolean;
      entityType: EntityType;
    };
    const { isPrimary, entityType } = body;

    if (!entityType || !VALID_ENTITY_TYPES.has(entityType)) {
      return NextResponse.json(
        { error: "entityType is required in request body" },
        { status: 400 },
      );
    }

    const attachment = await findAttachment(id, entityType, orgId);
    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 },
      );
    }

    if (isPrimary) {
      switch (entityType) {
        case "accessory":
          await prisma.accessory_attachments.updateMany({
            where: { accessoryId: attachment.entityId },
            data: { isPrimary: false },
          });
          break;
        case "consumable":
          await prisma.consumable_attachments.updateMany({
            where: { consumableId: attachment.entityId },
            data: { isPrimary: false },
          });
          break;
        case "component":
          await prisma.component_attachments.updateMany({
            where: { componentId: attachment.entityId },
            data: { isPrimary: false },
          });
          break;
      }
    }

    switch (entityType) {
      case "accessory":
        return NextResponse.json(
          await prisma.accessory_attachments.update({
            where: { id },
            data: { isPrimary },
          }),
        );
      case "consumable":
        return NextResponse.json(
          await prisma.consumable_attachments.update({
            where: { id },
            data: { isPrimary },
          }),
        );
      case "component":
        return NextResponse.json(
          await prisma.component_attachments.update({
            where: { id },
            data: { isPrimary },
          }),
        );
    }
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
