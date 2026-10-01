-- Add organizationId column to shared tables for multi-tenant isolation
ALTER TABLE "public"."manufacturer" ADD COLUMN "organizationId" UUID;
ALTER TABLE "public"."supplier" ADD COLUMN "organizationId" UUID;
ALTER TABLE "public"."model" ADD COLUMN "organizationId" UUID;
ALTER TABLE "public"."location" ADD COLUMN "organizationId" UUID;
ALTER TABLE "public"."statusType" ADD COLUMN "organizationId" UUID;
ALTER TABLE "public"."assetCategoryType" ADD COLUMN "organizationId" UUID;
ALTER TABLE "public"."accessorieCategoryType" ADD COLUMN "organizationId" UUID;
ALTER TABLE "public"."consumableCategoryType" ADD COLUMN "organizationId" UUID;
ALTER TABLE "public"."licenceCategoryType" ADD COLUMN "organizationId" UUID;
ALTER TABLE "public"."component_categories" ADD COLUMN "organizationId" UUID;

-- Add suspendedAt to organizations for grace-period suspension
ALTER TABLE "public"."organizations" ADD COLUMN "suspendedAt" TIMESTAMP(6);

-- Backfill: assign all existing rows to the first organization
UPDATE "public"."manufacturer" SET "organizationId" = (SELECT id FROM "public"."organizations" LIMIT 1) WHERE "organizationId" IS NULL;
UPDATE "public"."supplier" SET "organizationId" = (SELECT id FROM "public"."organizations" LIMIT 1) WHERE "organizationId" IS NULL;
UPDATE "public"."model" SET "organizationId" = (SELECT id FROM "public"."organizations" LIMIT 1) WHERE "organizationId" IS NULL;
UPDATE "public"."location" SET "organizationId" = (SELECT id FROM "public"."organizations" LIMIT 1) WHERE "organizationId" IS NULL;
UPDATE "public"."statusType" SET "organizationId" = (SELECT id FROM "public"."organizations" LIMIT 1) WHERE "organizationId" IS NULL;
UPDATE "public"."assetCategoryType" SET "organizationId" = (SELECT id FROM "public"."organizations" LIMIT 1) WHERE "organizationId" IS NULL;
UPDATE "public"."accessorieCategoryType" SET "organizationId" = (SELECT id FROM "public"."organizations" LIMIT 1) WHERE "organizationId" IS NULL;
UPDATE "public"."consumableCategoryType" SET "organizationId" = (SELECT id FROM "public"."organizations" LIMIT 1) WHERE "organizationId" IS NULL;
UPDATE "public"."licenceCategoryType" SET "organizationId" = (SELECT id FROM "public"."organizations" LIMIT 1) WHERE "organizationId" IS NULL;
UPDATE "public"."component_categories" SET "organizationId" = (SELECT id FROM "public"."organizations" LIMIT 1) WHERE "organizationId" IS NULL;

-- Add FK constraints (CASCADE on org delete)
ALTER TABLE "public"."manufacturer" ADD CONSTRAINT "manufacturer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."supplier" ADD CONSTRAINT "supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."model" ADD CONSTRAINT "model_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."location" ADD CONSTRAINT "location_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."statusType" ADD CONSTRAINT "statusType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."assetCategoryType" ADD CONSTRAINT "assetCategoryType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."accessorieCategoryType" ADD CONSTRAINT "accessorieCategoryType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."consumableCategoryType" ADD CONSTRAINT "consumableCategoryType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."licenceCategoryType" ADD CONSTRAINT "licenceCategoryType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."component_categories" ADD CONSTRAINT "component_categories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add indexes for query performance
CREATE INDEX "manufacturer_organizationId_idx" ON "public"."manufacturer"("organizationId");
CREATE INDEX "supplier_organizationId_idx" ON "public"."supplier"("organizationId");
CREATE INDEX "model_organizationId_idx" ON "public"."model"("organizationId");
CREATE INDEX "location_organizationId_idx" ON "public"."location"("organizationId");
CREATE INDEX "statusType_organizationId_idx" ON "public"."statusType"("organizationId");
CREATE INDEX "assetCategoryType_organizationId_idx" ON "public"."assetCategoryType"("organizationId");
CREATE INDEX "accessorieCategoryType_organizationId_idx" ON "public"."accessorieCategoryType"("organizationId");
CREATE INDEX "consumableCategoryType_organizationId_idx" ON "public"."consumableCategoryType"("organizationId");
CREATE INDEX "licenceCategoryType_organizationId_idx" ON "public"."licenceCategoryType"("organizationId");
CREATE INDEX "component_categories_organizationId_idx" ON "public"."component_categories"("organizationId");
