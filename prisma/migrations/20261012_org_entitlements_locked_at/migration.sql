-- SaaS boundary phase 1a (docs/superpowers/specs/2026-10-05-saas-boundary-design.md, section 7).
-- Expand only: two nullable columns, no default, no backfill. Nothing reads them in this
-- release. "entitlements" is filled by the legacy billing writers and by
-- scripts/backfill-entitlements.ts; "lockedAt" is written only by the internal API (phase 1b).
-- Adding a nullable column without a default is a catalog-only change, safe on the shared
-- production database.
ALTER TABLE "public"."organizations" ADD COLUMN IF NOT EXISTS "entitlements" JSONB;
ALTER TABLE "public"."organizations" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(6);
