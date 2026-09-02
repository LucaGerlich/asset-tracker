CREATE SCHEMA IF NOT EXISTS "public";
SET search_path TO "public";
-- Add thumbnailPath column to asset_attachments for storing thumbnail references
ALTER TABLE "asset_attachments" ADD COLUMN IF NOT EXISTS "thumbnailPath" VARCHAR(500);
