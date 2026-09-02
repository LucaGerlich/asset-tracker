SET search_path TO "public";
ALTER TABLE "supplier" ADD COLUMN IF NOT EXISTS "website" VARCHAR(500);
