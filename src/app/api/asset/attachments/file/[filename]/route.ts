import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { getOrganizationContext } from "@/lib/organization-context";
import { getStorage, getOrgStorage } from "@/lib/storage";
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

    // Find attachment and verify org access
    const attachment = await prisma.asset_attachments.findFirst({
      where: {
        filename,
        ...(orgId ? { asset: { organizationId: orgId } } : {}),
      },
    });

    if (!attachment) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const storage = orgId ? await getOrgStorage(orgId) : await getStorage();

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

    // Cloud storage: redirect to pre-signed URL
    const url = await storage.getUrl(key);
    if (url) {
      return NextResponse.redirect(url);
    }

    // Local storage: stream the file
    const { buffer, contentType } = await storage.download(key);

    // Force download for non-image types (defense-in-depth against XSS)
    const isImage = /^image\/(png|jpe?g|gif|webp)$/.test(contentType);
    const disposition = isImage ? "inline" : "attachment";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(attachment.originalName || key)}"`,
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
