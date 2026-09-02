-- Backfill organizationId on all entity records that have it as NULL.
-- Assigns them to the first active organization found (by creation date).
-- Only updates tables that actually have an organizationId column.

SET search_path TO "public";

DO $$
DECLARE
  default_org_id UUID;
BEGIN
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

  -- Core entities (all have organizationId column)
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

  -- Supporting entities that have organizationId
  UPDATE "components"
    SET "organizationId" = default_org_id
    WHERE "organizationId" IS NULL;

  UPDATE "webhooks"
    SET "organizationId" = default_org_id
    WHERE "organizationId" IS NULL;

  UPDATE "eula_templates"
    SET "organizationId" = default_org_id
    WHERE "organizationId" IS NULL;

  UPDATE "kits"
    SET "organizationId" = default_org_id
    WHERE "organizationId" IS NULL;

  UPDATE "audit_campaigns"
    SET "organizationId" = default_org_id
    WHERE "organizationId" IS NULL;

END $$;
