-- Per-org object storage config + image attachments for accessories, consumables, components.
-- IF NOT EXISTS is used because these tables were initially created out-of-band on the
-- primary database; this keeps `migrate deploy` idempotent across all environments.
-- Schema is "public" here; set-schema.mjs rewrites it to the target DB_SCHEMA at build time.

CREATE TABLE IF NOT EXISTS "public"."organization_storage_configs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "provider" VARCHAR(20) NOT NULL DEFAULT 's3',
  "endpoint" VARCHAR(500) NOT NULL,
  "bucket" VARCHAR(255) NOT NULL,
  "region" VARCHAR(50) NOT NULL DEFAULT 'auto',
  "accessKey" VARCHAR(500) NOT NULL,
  "secretKey" VARCHAR(500) NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "organization_storage_configs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_storage_configs_organizationId_key" UNIQUE ("organizationId"),
  CONSTRAINT "organization_storage_configs_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."accessory_attachments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "accessoryId" UUID NOT NULL,
  "filename" VARCHAR(255) NOT NULL,
  "originalName" VARCHAR(255) NOT NULL,
  "mimeType" VARCHAR(100) NOT NULL,
  "size" INTEGER NOT NULL,
  "path" VARCHAR(500) NOT NULL,
  "thumbnailPath" VARCHAR(500),
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "uploadedBy" UUID,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "accessory_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accessory_attachments_accessoryId_fkey"
    FOREIGN KEY ("accessoryId") REFERENCES "public"."accessories"("accessorieid") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "accessory_attachments_uploadedBy_fkey"
    FOREIGN KEY ("uploadedBy") REFERENCES "public"."user"("userid") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "accessory_attachments_accessoryId_idx" ON "public"."accessory_attachments"("accessoryId");

CREATE TABLE IF NOT EXISTS "public"."consumable_attachments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "consumableId" UUID NOT NULL,
  "filename" VARCHAR(255) NOT NULL,
  "originalName" VARCHAR(255) NOT NULL,
  "mimeType" VARCHAR(100) NOT NULL,
  "size" INTEGER NOT NULL,
  "path" VARCHAR(500) NOT NULL,
  "thumbnailPath" VARCHAR(500),
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "uploadedBy" UUID,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "consumable_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "consumable_attachments_consumableId_fkey"
    FOREIGN KEY ("consumableId") REFERENCES "public"."consumable"("consumableid") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "consumable_attachments_uploadedBy_fkey"
    FOREIGN KEY ("uploadedBy") REFERENCES "public"."user"("userid") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "consumable_attachments_consumableId_idx" ON "public"."consumable_attachments"("consumableId");

CREATE TABLE IF NOT EXISTS "public"."component_attachments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "componentId" UUID NOT NULL,
  "filename" VARCHAR(255) NOT NULL,
  "originalName" VARCHAR(255) NOT NULL,
  "mimeType" VARCHAR(100) NOT NULL,
  "size" INTEGER NOT NULL,
  "path" VARCHAR(500) NOT NULL,
  "thumbnailPath" VARCHAR(500),
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "uploadedBy" UUID,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "component_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "component_attachments_componentId_fkey"
    FOREIGN KEY ("componentId") REFERENCES "public"."components"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "component_attachments_uploadedBy_fkey"
    FOREIGN KEY ("uploadedBy") REFERENCES "public"."user"("userid") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "component_attachments_componentId_idx" ON "public"."component_attachments"("componentId");
