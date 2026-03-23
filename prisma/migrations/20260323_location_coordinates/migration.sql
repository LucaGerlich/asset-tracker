-- Add latitude/longitude to locations for map visualization
SET search_path TO "assettool";

ALTER TABLE "location" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "location" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
