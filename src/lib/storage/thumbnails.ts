import type { StorageProvider } from "./types";

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/tiff",
  "image/bmp",
]);

export function isImageMimeType(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.has(mimeType);
}

const THUMB_SIZES = {
  gallery: 400,
  list: 100,
} as const;

export type ThumbVariant = keyof typeof THUMB_SIZES;

export function thumbKey(uuid: string, variant: ThumbVariant): string {
  return `thumbs/${uuid}_${variant}.webp`;
}

export async function generateThumbnails(
  storage: StorageProvider,
  uuid: string,
  buffer: Buffer,
): Promise<string> {
  const sharp = (await import("sharp")).default;

  const variants = Object.entries(THUMB_SIZES) as [ThumbVariant, number][];
  await Promise.all(
    variants.map(async ([variant, width]) => {
      const thumb = await sharp(buffer, { limitInputPixels: 40_000_000 })
        .resize(width, undefined, { withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      await storage.upload(thumbKey(uuid, variant), thumb, "image/webp");
    }),
  );

  return thumbKey(uuid, "gallery");
}

export async function deleteThumbnails(
  storage: StorageProvider,
  uuid: string,
): Promise<void> {
  await Promise.all([
    storage.delete(thumbKey(uuid, "gallery")),
    storage.delete(thumbKey(uuid, "list")),
  ]);
}
