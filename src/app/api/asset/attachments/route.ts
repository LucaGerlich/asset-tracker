import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, requireNotDemoMode } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { basename, extname } from "path";
import crypto from "crypto";
import { getStorage, getOrgStorage } from "@/lib/storage";
import { isImageMimeType, generateThumbnails } from "@/lib/storage/thumbnails";
import { logger } from "@/lib/logger";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Magic bytes (file signatures) for content-type validation
// Prevents extension spoofing by checking actual file content
const MAGIC_BYTES: Record<string, number[][]> = {
  // Images
  ".png": [[0x89, 0x50, 0x4e, 0x47]],
  ".jpg": [[0xff, 0xd8, 0xff]],
  ".jpeg": [[0xff, 0xd8, 0xff]],
  ".gif": [[0x47, 0x49, 0x46, 0x38]],
  ".webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF header
  // SVG removed — can contain embedded scripts (XSS risk when served same-origin)
  // Documents
  ".pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
  ".docx": [[0x50, 0x4b, 0x03, 0x04]], // ZIP (OOXML)
  ".xlsx": [[0x50, 0x4b, 0x03, 0x04]], // ZIP (OOXML)
  ".csv": [], // Text-based, skip magic check
  ".txt": [], // Text-based, skip magic check
};

function validateMagicBytes(buffer: Buffer, ext: string): boolean {
  const signatures = MAGIC_BYTES[ext];
  if (!signatures || signatures.length === 0) return true; // Text-based or unlisted formats skip check
  return signatures.some((sig) => sig.every((byte, i) => buffer[i] === byte));
}

// Trusted MIME per allowed extension. The browser-supplied file.type is never
// persisted or served — a real file can be uploaded with a spoofed type to
// attempt content-type-confusion XSS. The served type is always derived here.
const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".rtf": "application/rtf",
  ".zip": "application/zip",
  ".gz": "application/gzip",
};

const ALLOWED_EXTENSIONS = new Set(Object.keys(EXT_TO_MIME));

function sanitizeFilename(name: string): string {
  const base = basename(name);
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function GET(req: NextRequest) {
  try {
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const { searchParams } = new URL(req.url);
    const assetId = searchParams.get("assetId");

    if (!assetId) {
      return NextResponse.json(
        { error: "assetId is required" },
        { status: 400 },
      );
    }

    // Verify asset belongs to user's organization
    const asset = await prisma.asset.findFirst({
      where: scopeToOrganization({ assetid: assetId }, orgId),
      select: { assetid: true },
    });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const attachments = await prisma.asset_attachments.findMany({
      where: { assetId },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            userid: true,
            firstname: true,
            lastname: true,
          },
        },
      },
    });

    return NextResponse.json(attachments);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch attachments" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const user = await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const assetId = formData.get("assetId") as string | null;
    const isPrimaryRaw = formData.get("isPrimary");
    const isPrimary = isPrimaryRaw === "true";

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (!assetId) {
      return NextResponse.json(
        { error: "assetId is required" },
        { status: 400 },
      );
    }

    // Verify asset belongs to user's organization
    const asset = await prisma.asset.findFirst({
      where: scopeToOrganization({ assetid: assetId }, orgId),
      select: { assetid: true },
    });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 10 MB limit" },
        { status: 400 },
      );
    }

    const ext = extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `File type '${ext}' is not allowed` },
        { status: 400 },
      );
    }

    // Sanitize filename to prevent path traversal
    const safeName = sanitizeFilename(file.name);
    const uniqueFilename = `${crypto.randomUUID()}${ext}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate file content matches its extension (prevents extension spoofing)
    if (!validateMagicBytes(buffer, ext)) {
      return NextResponse.json(
        { error: "File content does not match its extension" },
        { status: 400 },
      );
    }

    // Trusted MIME derived from the validated extension — never file.type.
    const trustedMime = EXT_TO_MIME[ext];

    const storage = orgId ? await getOrgStorage(orgId) : await getStorage();
    await storage.upload(uniqueFilename, buffer, trustedMime);

    // Generate thumbnails for images
    let thumbnailPath: string | null = null;
    if (isImageMimeType(trustedMime)) {
      try {
        const uuid = uniqueFilename.replace(/\.[^.]+$/, "");
        thumbnailPath = await generateThumbnails(storage, uuid, buffer);
      } catch {
        // Thumbnail generation is non-critical
      }
    }

    const attachment = await prisma.asset_attachments.create({
      data: {
        assetId,
        filename: uniqueFilename,
        originalName: safeName,
        mimeType: trustedMime,
        size: file.size,
        path: `/api/asset/attachments/file/${uniqueFilename}`,
        thumbnailPath,
        isPrimary,
        uploadedBy: user.id,
      },
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Asset attachment upload failed", { error });
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to upload attachment: ${detail}` },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
