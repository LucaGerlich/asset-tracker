CREATE SCHEMA IF NOT EXISTS "public";
SET search_path TO "public";
-- BetterAuth Schema Migration
-- Renames columns to match BetterAuth conventions (preserves data)

-- ============================================================
-- accounts table: rename columns (idempotent: check if old column exists)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'provider') THEN
    ALTER TABLE "accounts" RENAME COLUMN "provider" TO "providerId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'providerAccountId') THEN
    ALTER TABLE "accounts" RENAME COLUMN "providerAccountId" TO "accountId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'access_token') THEN
    ALTER TABLE "accounts" RENAME COLUMN "access_token" TO "accessToken";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'refresh_token') THEN
    ALTER TABLE "accounts" RENAME COLUMN "refresh_token" TO "refreshToken";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'id_token') THEN
    ALTER TABLE "accounts" RENAME COLUMN "id_token" TO "idToken";
  END IF;
END $$;

-- Drop old columns no longer needed by BetterAuth
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "type";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "token_type";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "session_state";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "expires_at";

-- Add new BetterAuth columns
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "accessTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "refreshTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "password" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "scope" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Update unique constraint
DROP INDEX IF EXISTS "accounts_provider_providerAccountId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_providerId_accountId_key" ON "accounts"("providerId", "accountId");

-- ============================================================
-- sessions table: rename columns (idempotent)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'sessionToken') THEN
    ALTER TABLE "sessions" RENAME COLUMN "sessionToken" TO "token";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'expires') THEN
    ALTER TABLE "sessions" RENAME COLUMN "expires" TO "expiresAt";
  END IF;
END $$;

-- Add updatedAt column
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Update indexes
DROP INDEX IF EXISTS "sessions_sessionToken_key";
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_key" ON "sessions"("token");
DROP INDEX IF EXISTS "sessions_expires_idx";
CREATE INDEX IF NOT EXISTS "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- ============================================================
-- user table: add BetterAuth fields
-- ============================================================
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "image" TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ============================================================
-- verification_tokens -> verification
-- ============================================================
DROP TABLE IF EXISTS "verification_tokens";

CREATE TABLE IF NOT EXISTS "verification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- twoFactor table (BetterAuth 2FA plugin)
-- ============================================================
CREATE TABLE IF NOT EXISTS "twoFactor" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    CONSTRAINT "twoFactor_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("userid") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
