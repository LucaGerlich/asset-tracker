-- API key lookup id (technical debt 95). New keys store the first 16 characters
-- ("at_live_" + 8 random characters) so validation matches at most one row instead of
-- bcrypt-comparing against every active key. Existing rows keep their 8-character prefix
-- and are still accepted through the legacy fallback in src/lib/api-keys.ts.
-- Widening a VARCHAR is a catalog-only change in PostgreSQL (no table rewrite).
ALTER TABLE "public"."api_keys" ALTER COLUMN "keyPrefix" TYPE VARCHAR(16);
