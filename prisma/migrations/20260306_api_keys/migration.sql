CREATE SCHEMA IF NOT EXISTS "public";
SET search_path TO "public";
-- CreateTable
CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "keyPrefix" VARCHAR(8) NOT NULL,
    "keyHash" VARCHAR(255) NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastUsedAt" TIMESTAMP(6),
    "expiresAt" TIMESTAMP(6),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT now(),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "api_keys_userId_idx" ON "api_keys"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "api_keys_keyPrefix_idx" ON "api_keys"("keyPrefix");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "api_keys_isActive_idx" ON "api_keys"("isActive");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("userid") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
