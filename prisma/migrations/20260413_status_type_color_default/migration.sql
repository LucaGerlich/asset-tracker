-- Add color and isDefault columns to statusType
ALTER TABLE "public"."statusType" ADD COLUMN "color" VARCHAR(7);
ALTER TABLE "public"."statusType" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
