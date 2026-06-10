import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { getOrganizationContext } from "@/lib/organization-context";
import { getOrgStorage } from "@/lib/storage";
import { thumbKey, type ThumbVariant } from "@/lib/storage/thumbnails";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const { filename } = await params;

    // Search all three entity attachment tables concurrently
    const [accessoryAtt, consumableAtt, componentAtt] = await Promise.all([
      prisma.accessory_attachments.findFirst({
        where: {
          filename,
          ...(orgId ? { accessory: { organizationId: orgId } } : {}),
        },
      }),
      prisma.consumable_attachments.findFirst({
        where: {
          filename,
          ...(orgId ? { consumable: { organizationId: orgId } } : {}),
        },
      }),
      prisma.component_attachments.findFirst({
        where: {
          filename,
          ...(orgId ? { component: { organizationId: orgId } } : {}),
        },
      }),
    ]);

    const attachment = accessoryAtt ?? consumableAtt ?? componentAtt;
    if (!attachment) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 400 },
      );
    }

    const storage = await getOrgStorage(orgId);

    const { searchParams } = new URL(req.url);
    const thumb = searchParams.get("thumb") as ThumbVariant | null;

    let key = attachment.filename;
    if (
      thumb &&
      (thumb === "gallery" || thumb === "list") &&
      attachment.thumbnailPath
    ) {
      const uuid = attachment.filename.replace(/\.[^.]+$/, "");
      key = thumbKey(uuid, thumb);
    }

    const url = await storage.getUrl(key);
    if (url) {
      return NextResponse.redirect(url);
    }

    const { buffer, contentType } = await storage.download(key);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.originalName || key)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=86400",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
