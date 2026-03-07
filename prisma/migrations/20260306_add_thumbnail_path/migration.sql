CREATE SCHEMA IF NOT EXISTS "assettool";
SET search_path TO "assettool";
-- Add thumbnailPath column to asset_attachments for storing thumbnail references
ALTER TABLE "asset_attachments" ADD COLUMN "thumbnailPath" VARCHAR(500);
