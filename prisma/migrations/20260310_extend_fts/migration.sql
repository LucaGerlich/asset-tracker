-- Extend full-text search (tsvector + GIN) to additional entity tables
CREATE SCHEMA IF NOT EXISTS "assettool";
SET search_path TO "assettool";

-- ============================================================
-- 1. accessories — search on accessoriename, accessorietag
-- ============================================================

ALTER TABLE "accessories" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("accessoriename", '') || ' ' || coalesce("accessorietag", ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_accessories_search ON "accessories" USING GIN ("search_vector");

-- ============================================================
-- 2. consumable — search on consumablename
-- ============================================================

ALTER TABLE "consumable" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("consumablename", ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_consumable_search ON "consumable" USING GIN ("search_vector");

-- ============================================================
-- 3. licence — search on licencekey, licensedtoemail
-- ============================================================

ALTER TABLE "licence" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("licencekey", '') || ' ' || coalesce("licensedtoemail", ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_licence_search ON "licence" USING GIN ("search_vector");

-- ============================================================
-- 4. components — search on name, serialNumber
-- ============================================================

ALTER TABLE "components" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("name", '') || ' ' || coalesce("serialNumber", ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_components_search ON "components" USING GIN ("search_vector");

-- ============================================================
-- 5. user — search on firstname, lastname, username, email
-- ============================================================

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce("firstname", '') || ' ' ||
      coalesce("lastname", '') || ' ' ||
      coalesce("username", '') || ' ' ||
      coalesce("email", '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_user_search ON "user" USING GIN ("search_vector");
