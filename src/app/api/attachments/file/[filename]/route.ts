import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { getOrganizationContext } from "@/lib/organization-context";
import { getOrgStorage } from "@/lib/storage";
import { thumbKey, type ThumbVariant } from "@/lib/storage/thumbnails";

// Only ever serve files with a known-safe image Content-Type. Anything outside
// this set is forced to a non-renderable type so a misdeclared file cannot
// execute script on the app origin (content-type-confusion XSS).
const SAFE_IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    // Fail closed: a concrete org is required before any tenant-scoped query.
    if (!orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { filename } = await params;

    // Search all three entity attachment tables concurrently
    const [accessoryAtt, consumableAtt, componentAtt] = await Promise.all([
      prisma.accessory_attachments.findFirst({
        where: { filename, accessory: { organizationId: orgId } },
      }),
      prisma.consumable_attachments.findFirst({
        where: { filename, consumable: { organizationId: orgId } },
      }),
      prisma.component_attachments.findFirst({
        where: { filename, component: { organizationId: orgId } },
      }),
    ]);

    const attachment = accessoryAtt ?? consumableAtt ?? componentAtt;
    if (!attachment) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const storage = await getOrgStorage(orgId);

    const { searchParams } = new URL(req.url);
    const thumb = searchParams.get("thumb") as ThumbVariant | null;

    let key = attachment.filename;
    const isThumb =
      thumb &&
      (thumb === "gallery" || thumb === "list") &&
      attachment.thumbnailPath;
    if (isThumb) {
      const uuid = attachment.filename.replace(/\.[^.]+$/, "");
      key = thumbKey(uuid, thumb);
    }

    const url = await storage.getUrl(key);
    if (url) {
      return NextResponse.redirect(url);
    }

    const { buffer } = await storage.download(key);

    // Derive the served Content-Type from trusted metadata, never from the
    // bytes/headers the uploader controlled. Thumbnails are always WebP.
    const storedMime = isThumb ? "image/webp" : attachment.mimeType;
    const isSafeImage = SAFE_IMAGE_MIME.has(storedMime);
    const contentType = isSafeImage ? storedMime : "application/octet-stream";
    const disposition = isSafeImage ? "inline" : "attachment";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(attachment.originalName || key)}"`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
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
