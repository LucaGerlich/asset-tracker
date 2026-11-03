-- Business keys unique per organization instead of globally (technical debt 97).
-- purchase_orders."poNumber": the sequence is per organization, so two tenants' first PO of
--   a month ("PO-YYYYMM-0001") collided on the global unique constraint.
-- licence."licencekey": a global unique index was a cross-tenant existence oracle.
-- Every existing row satisfies the narrower composite constraint (it is implied by the old
-- global one), so the new indexes cannot fail on existing data. A NULL organizationId or
-- licencekey never conflicts (PostgreSQL treats NULLs as distinct).
-- Order: create the composite index first so uniqueness is never unenforced, then drop the
-- global one.

CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_organizationId_poNumber_key"
  ON "public"."purchase_orders"("organizationId", "poNumber");
ALTER TABLE "public"."purchase_orders" DROP CONSTRAINT IF EXISTS "purchase_orders_poNumber_key";

CREATE UNIQUE INDEX IF NOT EXISTS "licence_organizationId_licencekey_key"
  ON "public"."licence"("organizationId", "licencekey");
-- Dropped as a constraint first in case the database created it that way (a constraint
-- cannot be removed with DROP INDEX), then as a plain index.
ALTER TABLE "public"."licence" DROP CONSTRAINT IF EXISTS "licence_licencekey_key";
DROP INDEX IF EXISTS "public"."licence_licencekey_key";
