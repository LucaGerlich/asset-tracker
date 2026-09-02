SET search_path TO "public";

-- Add parent location reference for hierarchical locations
ALTER TABLE "location" ADD COLUMN IF NOT EXISTS "parentId" UUID;
ALTER TABLE "location" ADD CONSTRAINT "fk_location_parent"
  FOREIGN KEY ("parentId") REFERENCES "location"("locationid")
  ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "idx_location_parent" ON "location" ("parentId");
