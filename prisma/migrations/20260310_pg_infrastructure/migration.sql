-- PostgreSQL infrastructure: cache, rate limits, and full-text search
CREATE SCHEMA IF NOT EXISTS "public";
SET search_path TO "public";

-- ============================================================
-- 1. Cache table (UNLOGGED for performance)
-- ============================================================

CREATE UNLOGGED TABLE IF NOT EXISTS "cache" (
  "key" VARCHAR(255) PRIMARY KEY,
  "value" JSONB NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON "cache" ("expires_at");

-- ============================================================
-- 2. Rate limits table
-- ============================================================

CREATE TABLE IF NOT EXISTS "rate_limits" (
  "key" VARCHAR(255) PRIMARY KEY,
  "count" INTEGER NOT NULL DEFAULT 1,
  "reset_at" TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON "rate_limits" ("reset_at");

-- ============================================================
-- 3. Full-text search on assets
-- ============================================================

ALTER TABLE "asset" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce("assetname", '') || ' ' ||
      coalesce("assettag", '') || ' ' ||
      coalesce("serialnumber", '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_asset_search ON "asset" USING GIN ("search_vector");

-- ============================================================
-- 4. Seed reference data (idempotent — skips existing entries)
-- ============================================================

-- Status Types
INSERT INTO "statusType" ("statustypename") SELECT 'Active'         WHERE NOT EXISTS (SELECT 1 FROM "statusType" WHERE LOWER("statustypename") = LOWER('Active'));
INSERT INTO "statusType" ("statustypename") SELECT 'Available'      WHERE NOT EXISTS (SELECT 1 FROM "statusType" WHERE LOWER("statustypename") = LOWER('Available'));
INSERT INTO "statusType" ("statustypename") SELECT 'Pending'        WHERE NOT EXISTS (SELECT 1 FROM "statusType" WHERE LOWER("statustypename") = LOWER('Pending'));
INSERT INTO "statusType" ("statustypename") SELECT 'Archived'       WHERE NOT EXISTS (SELECT 1 FROM "statusType" WHERE LOWER("statustypename") = LOWER('Archived'));
INSERT INTO "statusType" ("statustypename") SELECT 'Out for Repair' WHERE NOT EXISTS (SELECT 1 FROM "statusType" WHERE LOWER("statustypename") = LOWER('Out for Repair'));
INSERT INTO "statusType" ("statustypename") SELECT 'Lost/Stolen'    WHERE NOT EXISTS (SELECT 1 FROM "statusType" WHERE LOWER("statustypename") = LOWER('Lost/Stolen'));
INSERT INTO "statusType" ("statustypename") SELECT 'Retired'        WHERE NOT EXISTS (SELECT 1 FROM "statusType" WHERE LOWER("statustypename") = LOWER('Retired'));
INSERT INTO "statusType" ("statustypename") SELECT 'Reserved'       WHERE NOT EXISTS (SELECT 1 FROM "statusType" WHERE LOWER("statustypename") = LOWER('Reserved'));
INSERT INTO "statusType" ("statustypename") SELECT 'In Transit'     WHERE NOT EXISTS (SELECT 1 FROM "statusType" WHERE LOWER("statustypename") = LOWER('In Transit'));
INSERT INTO "statusType" ("statustypename") SELECT 'Disposed'       WHERE NOT EXISTS (SELECT 1 FROM "statusType" WHERE LOWER("statustypename") = LOWER('Disposed'));

-- Asset Categories
INSERT INTO "assetCategoryType" ("assetcategorytypename") SELECT 'Laptop'                WHERE NOT EXISTS (SELECT 1 FROM "assetCategoryType" WHERE LOWER("assetcategorytypename") = LOWER('Laptop'));
INSERT INTO "assetCategoryType" ("assetcategorytypename") SELECT 'Desktop'               WHERE NOT EXISTS (SELECT 1 FROM "assetCategoryType" WHERE LOWER("assetcategorytypename") = LOWER('Desktop'));
INSERT INTO "assetCategoryType" ("assetcategorytypename") SELECT 'Smartphone'            WHERE NOT EXISTS (SELECT 1 FROM "assetCategoryType" WHERE LOWER("assetcategorytypename") = LOWER('Smartphone'));
INSERT INTO "assetCategoryType" ("assetcategorytypename") SELECT 'Tablet'                WHERE NOT EXISTS (SELECT 1 FROM "assetCategoryType" WHERE LOWER("assetcategorytypename") = LOWER('Tablet'));
INSERT INTO "assetCategoryType" ("assetcategorytypename") SELECT 'Display'               WHERE NOT EXISTS (SELECT 1 FROM "assetCategoryType" WHERE LOWER("assetcategorytypename") = LOWER('Display'));
INSERT INTO "assetCategoryType" ("assetcategorytypename") SELECT 'Phone'                 WHERE NOT EXISTS (SELECT 1 FROM "assetCategoryType" WHERE LOWER("assetcategorytypename") = LOWER('Phone'));
INSERT INTO "assetCategoryType" ("assetcategorytypename") SELECT 'Printer'               WHERE NOT EXISTS (SELECT 1 FROM "assetCategoryType" WHERE LOWER("assetcategorytypename") = LOWER('Printer'));
INSERT INTO "assetCategoryType" ("assetcategorytypename") SELECT 'Server'                WHERE NOT EXISTS (SELECT 1 FROM "assetCategoryType" WHERE LOWER("assetcategorytypename") = LOWER('Server'));
INSERT INTO "assetCategoryType" ("assetcategorytypename") SELECT 'Network Equipment'     WHERE NOT EXISTS (SELECT 1 FROM "assetCategoryType" WHERE LOWER("assetcategorytypename") = LOWER('Network Equipment'));
INSERT INTO "assetCategoryType" ("assetcategorytypename") SELECT 'Storage Device'        WHERE NOT EXISTS (SELECT 1 FROM "assetCategoryType" WHERE LOWER("assetcategorytypename") = LOWER('Storage Device'));
INSERT INTO "assetCategoryType" ("assetcategorytypename") SELECT 'Audio/Video Equipment' WHERE NOT EXISTS (SELECT 1 FROM "assetCategoryType" WHERE LOWER("assetcategorytypename") = LOWER('Audio/Video Equipment'));
INSERT INTO "assetCategoryType" ("assetcategorytypename") SELECT 'Furniture'             WHERE NOT EXISTS (SELECT 1 FROM "assetCategoryType" WHERE LOWER("assetcategorytypename") = LOWER('Furniture'));
INSERT INTO "assetCategoryType" ("assetcategorytypename") SELECT 'Vehicle'               WHERE NOT EXISTS (SELECT 1 FROM "assetCategoryType" WHERE LOWER("assetcategorytypename") = LOWER('Vehicle'));
INSERT INTO "assetCategoryType" ("assetcategorytypename") SELECT 'Other'                 WHERE NOT EXISTS (SELECT 1 FROM "assetCategoryType" WHERE LOWER("assetcategorytypename") = LOWER('Other'));

-- Accessory Categories
INSERT INTO "accessorieCategoryType" ("accessoriecategorytypename") SELECT 'Keyboard'       WHERE NOT EXISTS (SELECT 1 FROM "accessorieCategoryType" WHERE LOWER("accessoriecategorytypename") = LOWER('Keyboard'));
INSERT INTO "accessorieCategoryType" ("accessoriecategorytypename") SELECT 'Mouse'           WHERE NOT EXISTS (SELECT 1 FROM "accessorieCategoryType" WHERE LOWER("accessoriecategorytypename") = LOWER('Mouse'));
INSERT INTO "accessorieCategoryType" ("accessoriecategorytypename") SELECT 'Headset'         WHERE NOT EXISTS (SELECT 1 FROM "accessorieCategoryType" WHERE LOWER("accessoriecategorytypename") = LOWER('Headset'));
INSERT INTO "accessorieCategoryType" ("accessoriecategorytypename") SELECT 'Webcam'          WHERE NOT EXISTS (SELECT 1 FROM "accessorieCategoryType" WHERE LOWER("accessoriecategorytypename") = LOWER('Webcam'));
INSERT INTO "accessorieCategoryType" ("accessoriecategorytypename") SELECT 'Cable'           WHERE NOT EXISTS (SELECT 1 FROM "accessorieCategoryType" WHERE LOWER("accessoriecategorytypename") = LOWER('Cable'));
INSERT INTO "accessorieCategoryType" ("accessoriecategorytypename") SELECT 'Adapter'         WHERE NOT EXISTS (SELECT 1 FROM "accessorieCategoryType" WHERE LOWER("accessoriecategorytypename") = LOWER('Adapter'));
INSERT INTO "accessorieCategoryType" ("accessoriecategorytypename") SELECT 'Docking Station' WHERE NOT EXISTS (SELECT 1 FROM "accessorieCategoryType" WHERE LOWER("accessoriecategorytypename") = LOWER('Docking Station'));
INSERT INTO "accessorieCategoryType" ("accessoriecategorytypename") SELECT 'Bag/Case'        WHERE NOT EXISTS (SELECT 1 FROM "accessorieCategoryType" WHERE LOWER("accessoriecategorytypename") = LOWER('Bag/Case'));
INSERT INTO "accessorieCategoryType" ("accessoriecategorytypename") SELECT 'Charger'         WHERE NOT EXISTS (SELECT 1 FROM "accessorieCategoryType" WHERE LOWER("accessoriecategorytypename") = LOWER('Charger'));
INSERT INTO "accessorieCategoryType" ("accessoriecategorytypename") SELECT 'Stand/Mount'     WHERE NOT EXISTS (SELECT 1 FROM "accessorieCategoryType" WHERE LOWER("accessoriecategorytypename") = LOWER('Stand/Mount'));
INSERT INTO "accessorieCategoryType" ("accessoriecategorytypename") SELECT 'USB Drive'       WHERE NOT EXISTS (SELECT 1 FROM "accessorieCategoryType" WHERE LOWER("accessoriecategorytypename") = LOWER('USB Drive'));
INSERT INTO "accessorieCategoryType" ("accessoriecategorytypename") SELECT 'Other'           WHERE NOT EXISTS (SELECT 1 FROM "accessorieCategoryType" WHERE LOWER("accessoriecategorytypename") = LOWER('Other'));

-- Consumable Categories
INSERT INTO "consumableCategoryType" ("consumablecategorytypename") SELECT 'Ink Cartridge'    WHERE NOT EXISTS (SELECT 1 FROM "consumableCategoryType" WHERE LOWER("consumablecategorytypename") = LOWER('Ink Cartridge'));
INSERT INTO "consumableCategoryType" ("consumablecategorytypename") SELECT 'Toner'            WHERE NOT EXISTS (SELECT 1 FROM "consumableCategoryType" WHERE LOWER("consumablecategorytypename") = LOWER('Toner'));
INSERT INTO "consumableCategoryType" ("consumablecategorytypename") SELECT 'Paper'            WHERE NOT EXISTS (SELECT 1 FROM "consumableCategoryType" WHERE LOWER("consumablecategorytypename") = LOWER('Paper'));
INSERT INTO "consumableCategoryType" ("consumablecategorytypename") SELECT 'Label'            WHERE NOT EXISTS (SELECT 1 FROM "consumableCategoryType" WHERE LOWER("consumablecategorytypename") = LOWER('Label'));
INSERT INTO "consumableCategoryType" ("consumablecategorytypename") SELECT 'Battery'          WHERE NOT EXISTS (SELECT 1 FROM "consumableCategoryType" WHERE LOWER("consumablecategorytypename") = LOWER('Battery'));
INSERT INTO "consumableCategoryType" ("consumablecategorytypename") SELECT 'Cleaning Supply'  WHERE NOT EXISTS (SELECT 1 FROM "consumableCategoryType" WHERE LOWER("consumablecategorytypename") = LOWER('Cleaning Supply'));
INSERT INTO "consumableCategoryType" ("consumablecategorytypename") SELECT 'Cable Tie/Velcro' WHERE NOT EXISTS (SELECT 1 FROM "consumableCategoryType" WHERE LOWER("consumablecategorytypename") = LOWER('Cable Tie/Velcro'));
INSERT INTO "consumableCategoryType" ("consumablecategorytypename") SELECT 'Thermal Paste'    WHERE NOT EXISTS (SELECT 1 FROM "consumableCategoryType" WHERE LOWER("consumablecategorytypename") = LOWER('Thermal Paste'));
INSERT INTO "consumableCategoryType" ("consumablecategorytypename") SELECT 'Other'            WHERE NOT EXISTS (SELECT 1 FROM "consumableCategoryType" WHERE LOWER("consumablecategorytypename") = LOWER('Other'));

-- Licence Categories
INSERT INTO "licenceCategoryType" ("licencecategorytypename") SELECT 'Operating System'      WHERE NOT EXISTS (SELECT 1 FROM "licenceCategoryType" WHERE LOWER("licencecategorytypename") = LOWER('Operating System'));
INSERT INTO "licenceCategoryType" ("licencecategorytypename") SELECT 'Productivity Software'  WHERE NOT EXISTS (SELECT 1 FROM "licenceCategoryType" WHERE LOWER("licencecategorytypename") = LOWER('Productivity Software'));
INSERT INTO "licenceCategoryType" ("licencecategorytypename") SELECT 'Development Tools'      WHERE NOT EXISTS (SELECT 1 FROM "licenceCategoryType" WHERE LOWER("licencecategorytypename") = LOWER('Development Tools'));
INSERT INTO "licenceCategoryType" ("licencecategorytypename") SELECT 'Security Software'      WHERE NOT EXISTS (SELECT 1 FROM "licenceCategoryType" WHERE LOWER("licencecategorytypename") = LOWER('Security Software'));
INSERT INTO "licenceCategoryType" ("licencecategorytypename") SELECT 'Cloud Service'          WHERE NOT EXISTS (SELECT 1 FROM "licenceCategoryType" WHERE LOWER("licencecategorytypename") = LOWER('Cloud Service'));
INSERT INTO "licenceCategoryType" ("licencecategorytypename") SELECT 'Design Software'        WHERE NOT EXISTS (SELECT 1 FROM "licenceCategoryType" WHERE LOWER("licencecategorytypename") = LOWER('Design Software'));
INSERT INTO "licenceCategoryType" ("licencecategorytypename") SELECT 'Communication Software' WHERE NOT EXISTS (SELECT 1 FROM "licenceCategoryType" WHERE LOWER("licencecategorytypename") = LOWER('Communication Software'));
INSERT INTO "licenceCategoryType" ("licencecategorytypename") SELECT 'Database Software'      WHERE NOT EXISTS (SELECT 1 FROM "licenceCategoryType" WHERE LOWER("licencecategorytypename") = LOWER('Database Software'));
INSERT INTO "licenceCategoryType" ("licencecategorytypename") SELECT 'Other'                  WHERE NOT EXISTS (SELECT 1 FROM "licenceCategoryType" WHERE LOWER("licencecategorytypename") = LOWER('Other'));
