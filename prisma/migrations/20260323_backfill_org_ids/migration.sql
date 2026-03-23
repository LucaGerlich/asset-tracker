-- Backfill organizationId on all entity records that have it as NULL.
-- Assigns them to the first active organization found (by creation date).
-- This enables strict org scoping (no more inclusive null fallback).

SET search_path TO "assettool";

DO $$
DECLARE
  default_org_id UUID;
BEGIN
  -- Use actual SQL table name (@@map("organizations") in Prisma)
  SELECT "id" INTO default_org_id
  FROM "organizations"
  WHERE "isActive" = true
  ORDER BY "createdAt" ASC
  LIMIT 1;

  IF default_org_id IS NULL THEN
    RAISE NOTICE 'No organization found — skipping backfill';
    RETURN;
  END IF;

  RAISE NOTICE 'Backfilling organizationId with org: %', default_org_id;

  -- Core entities (table names match Prisma schema, not model names)
  UPDATE "asset"
    SET "organizationId" = default_org_id
    WHERE "organizationId" IS NULL;

  UPDATE "accessories"
    SET "organizationId" = default_org_id
    WHERE "organizationId" IS NULL;

  UPDATE "consumable"
    SET "organizationId" = default_org_id
    WHERE "organizationId" IS NULL;

  UPDATE "licence"
    SET "organizationId" = default_org_id
    WHERE "organizationId" IS NULL;

  UPDATE "user"
    SET "organizationId" = default_org_id
    WHERE "organizationId" IS NULL;

  -- Supporting entities (use @@map table names)
  UPDATE "components"
    SET "organizationId" = default_org_id
    WHERE "organizationId" IS NULL;

  UPDATE "webhooks"
    SET "organizationId" = default_org_id
    WHERE "organizationId" IS NULL;

  UPDATE "automation_rules"
    SET "organizationId" = default_org_id
    WHERE "organizationId" IS NULL;

  UPDATE "eula_templates"
    SET "organizationId" = default_org_id
    WHERE "organizationId" IS NULL;

  UPDATE "kits"
    SET "organizationId" = default_org_id
    WHERE "organizationId" IS NULL;

END $$;
