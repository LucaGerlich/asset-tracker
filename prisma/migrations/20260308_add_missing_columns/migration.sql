-- Add missing columns that exist in Prisma schema but were never migrated
CREATE SCHEMA IF NOT EXISTS "assettool";
SET search_path TO "assettool";

-- Organization billing columns
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "plan" VARCHAR(20) NOT NULL DEFAULT 'starter';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "stripeCustomerId" VARCHAR(255);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" VARCHAR(255);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(6);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "maxAssets" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "maxUsers" INTEGER NOT NULL DEFAULT 3;

-- Unique indexes for Stripe columns
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_stripeCustomerId_key" ON "organizations"("stripeCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_stripeSubscriptionId_key" ON "organizations"("stripeSubscriptionId");

-- User MFA columns
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "mfaSecret" VARCHAR(255);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "mfaBackupCodes" TEXT[];

-- User LDAP/SSO columns
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "authProvider" VARCHAR(20) NOT NULL DEFAULT 'local';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "externalId" VARCHAR(255);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ldapDN" TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(6);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- User SCIM columns
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "scimProviderId" VARCHAR(255);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "scimLastSync" TIMESTAMP(6);
