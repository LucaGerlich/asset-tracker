-- PostgreSQL infrastructure: cache, rate limits, and full-text search
CREATE SCHEMA IF NOT EXISTS "assettool";
SET search_path TO "assettool";

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
