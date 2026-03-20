-- Performance optimizations migration
-- Based on analysis of query patterns and "You Just Need Postgres" principles

-- Set search_path to match the application schema
SET search_path TO "assettool";

-- ============================================================
-- 0. Ensure cache table exists (may have been lost if the
--    previous migration was marked applied but tables were
--    dropped, or UNLOGGED table was lost after a crash)
-- ============================================================

CREATE UNLOGGED TABLE IF NOT EXISTS "cache" (
  "key" VARCHAR(255) PRIMARY KEY,
  "value" JSONB NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON "cache" ("expires_at");

-- ============================================================
-- 1. Convert rate_limits to UNLOGGED table
--    Rate limit data is ephemeral (resets every 1-15 min).
--    WAL logging is unnecessary overhead for every API request.
--    Same pattern already used by the "cache" table.
-- ============================================================

-- Ensure rate_limits exists before attempting conversion
CREATE TABLE IF NOT EXISTS "rate_limits" (
  "key" VARCHAR(255) PRIMARY KEY,
  "count" INTEGER NOT NULL DEFAULT 1,
  "reset_at" TIMESTAMPTZ NOT NULL
);

-- Recreate as UNLOGGED (no ALTER TABLE for this, must recreate)
CREATE UNLOGGED TABLE IF NOT EXISTS "rate_limits_new" (
  "key" VARCHAR(255) PRIMARY KEY,
  "count" INTEGER NOT NULL DEFAULT 1,
  "reset_at" TIMESTAMPTZ NOT NULL
);

-- Copy any existing data (best-effort, data is transient anyway)
INSERT INTO "rate_limits_new" ("key", "count", "reset_at")
  SELECT "key", "count", "reset_at" FROM "rate_limits"
  WHERE "reset_at" > NOW()
  ON CONFLICT DO NOTHING;

-- Swap tables
DROP TABLE IF EXISTS "rate_limits";
ALTER TABLE "rate_limits_new" RENAME TO "rate_limits";

-- Recreate index
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON "rate_limits" ("reset_at");

-- ============================================================
-- 2. Add composite index for custom_field_definitions lookups
--    The asset detail page queries:
--      WHERE entityType = 'asset' AND isActive = true
--      ORDER BY displayOrder
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_custom_field_defs_entity_active
  ON "custom_field_definitions" ("entityType", "isActive", "displayOrder");

-- ============================================================
-- 3. Add index for maintenance_schedules by asset + due date
--    Asset detail page:
--      WHERE assetId = $1 ORDER BY nextDueDate LIMIT 5
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_asset_due
  ON "maintenance_schedules" ("assetId", "nextDueDate");

-- ============================================================
-- 4. Add index for audit_logs entity+entityId+createdAt
--    Asset detail page fetches history:
--      WHERE entity = 'asset' AND entityId = $1
--      ORDER BY createdAt DESC LIMIT 50
--    Existing index is (entity, entityId) but adding createdAt
--    allows an index-only sort.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id_created
  ON "audit_logs" ("entity", "entityId", "createdAt" DESC);

-- ============================================================
-- 5. Add index for notification_queue status lookups
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_notification_queue_status
  ON "notification_queue" ("status")
  WHERE "status" = 'pending';
