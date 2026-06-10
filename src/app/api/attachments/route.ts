import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, requireNotDemoMode } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { getOrganizationContext } from "@/lib/organization-context";
import { basename, extname } from "path";
import crypto from "crypto";
import { getOrgStorage } from "@/lib/storage";
import { isImageMimeType, generateThumbnails } from "@/lib/storage/thumbnails";

type EntityType = "accessory" | "consumable" | "component";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const MAGIC_BYTES: Record<string, number[][]> = {
  ".png": [[0x89, 0x50, 0x4e, 0x47]],
  ".jpg": [[0xff, 0xd8, 0xff]],
  ".jpeg": [[0xff, 0xd8, 0xff]],
  ".gif": [[0x47, 0x49, 0x46, 0x38]],
  ".webp": [[0x52, 0x49, 0x46, 0x46]],
};

function validateMagicBytes(buffer: Buffer, ext: string): boolean {
  const signatures = MAGIC_BYTES[ext];
  if (!signatures || signatures.length === 0) return true;
  return signatures.some((sig) => sig.every((byte, i) => buffer[i] === byte));
}

// Trusted MIME type derived from the (validated) extension. The browser-supplied
// `file.type` is never trusted for storage or serving — a real image can be
// uploaded with a spoofed `text/html` type to attempt content-type-confusion XSS.
const EXT_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const ALLOWED_EXTENSIONS = new Set(Object.keys(EXT_TO_MIME));

function sanitizeFilename(name: string): string {
  return basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
}

// Fail-closed org scoping: when orgId is undefined the filter becomes
// `organizationId: null` (only unscoped records), never an unfiltered query.
// Mirrors scopeToOrganization / verifyEntityOrgOwnership in organization-context.
async function verifyEntityOwnership(
  entityType: EntityType,
  entityId: string,
  orgId: string | undefined,
): Promise<boolean> {
  const organizationId = orgId ?? null;
  switch (entityType) {
    case "accessory": {
      const record = await prisma.accessories.findFirst({
        where: { accessorieid: entityId, organizationId },
        select: { accessorieid: true },
      });
      return !!record;
    }
    case "consumable": {
      const record = await prisma.consumable.findFirst({
        where: { consumableid: entityId, organizationId },
        select: { consumableid: true },
      });
      return !!record;
    }
    case "component": {
      const record = await prisma.component.findFirst({
        where: { id: entityId, organizationId },
        select: { id: true },
      });
      return !!record;
    }
  }
}

const VALID_ENTITY_TYPES = new Set<EntityType>([
  "accessory",
  "consumable",
  "component",
]);

export async function GET(req: NextRequest) {
  try {
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType") as EntityType | null;
    const entityId = searchParams.get("entityId");

    if (!entityType || !VALID_ENTITY_TYPES.has(entityType)) {
      return NextResponse.json(
        { error: "entityType must be accessory, consumable, or component" },
        { status: 400 },
      );
    }
    if (!entityId) {
      return NextResponse.json(
        { error: "entityId is required" },
        { status: 400 },
      );
    }

    const exists = await verifyEntityOwnership(entityType, entityId, orgId);
    if (!exists) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    const include = {
      user: { select: { userid: true, firstname: true, lastname: true } },
    };
    const orderBy = { createdAt: "desc" as const };

    switch (entityType) {
      case "accessory":
        return NextResponse.json(
          await prisma.accessory_attachments.findMany({
            where: { accessoryId: entityId },
            orderBy,
            include,
          }),
        );
      case "consumable":
        return NextResponse.json(
          await prisma.consumable_attachments.findMany({
            where: { consumableId: entityId },
            orderBy,
            include,
          }),
        );
      case "component":
        return NextResponse.json(
          await prisma.component_attachments.findMany({
            where: { componentId: entityId },
            orderBy,
            include,
          }),
        );
    }
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

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 400 },
      );
    }

    const storageConfig = await prisma.organizationStorageConfig.findUnique({
      where: { organizationId: orgId, isEnabled: true },
    });
    if (!storageConfig) {
      return NextResponse.json({ storageNotConfigured: true }, { status: 503 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const entityType = formData.get("entityType") as EntityType | null;
    const entityId = formData.get("entityId") as string | null;
    const isPrimary = formData.get("isPrimary") === "true";

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!entityType || !VALID_ENTITY_TYPES.has(entityType)) {
      return NextResponse.json(
        { error: "entityType must be accessory, consumable, or component" },
        { status: 400 },
      );
    }
    if (!entityId) {
      return NextResponse.json(
        { error: "entityId is required" },
        { status: 400 },
      );
    }

    const exists = await verifyEntityOwnership(entityType, entityId, orgId);
    if (!exists) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
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
        {
          error: `File type '${ext}' is not allowed. Only images (jpg, jpeg, png, gif, webp) are accepted.`,
        },
        { status: 400 },
      );
    }

    const safeName = sanitizeFilename(file.name);
    const uniqueFilename = `${crypto.randomUUID()}${ext}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!validateMagicBytes(buffer, ext)) {
      return NextResponse.json(
        { error: "File content does not match its extension" },
        { status: 400 },
      );
    }

    // Derive a trusted MIME from the validated extension — never persist or
    // serve the browser-supplied file.type (content-type-confusion XSS vector).
    const trustedMime = EXT_TO_MIME[ext];

    const storage = await getOrgStorage(orgId);
    await storage.upload(uniqueFilename, buffer, trustedMime);

    let thumbnailPath: string | null = null;
    if (isImageMimeType(trustedMime)) {
      try {
        const uuid = uniqueFilename.replace(/\.[^.]+$/, "");
        thumbnailPath = await generateThumbnails(storage, uuid, buffer);
      } catch {
        // Thumbnail generation is non-critical
      }
    }

    const filePath = `/api/attachments/file/${uniqueFilename}`;
    const baseData = {
      filename: uniqueFilename,
      originalName: safeName,
      mimeType: trustedMime,
      size: file.size,
      path: filePath,
      thumbnailPath,
      isPrimary,
      uploadedBy: user.id,
    };

    switch (entityType) {
      case "accessory":
        return NextResponse.json(
          await prisma.accessory_attachments.create({
            data: { ...baseData, accessoryId: entityId },
          }),
          { status: 201 },
        );
      case "consumable":
        return NextResponse.json(
          await prisma.consumable_attachments.create({
            data: { ...baseData, consumableId: entityId },
          }),
          { status: 201 },
        );
      case "component":
        return NextResponse.json(
          await prisma.component_attachments.create({
            data: { ...baseData, componentId: entityId },
          }),
          { status: 201 },
        );
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
