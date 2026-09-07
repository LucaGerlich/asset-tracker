-- MFA enrolment moves onto BetterAuth's twoFactor plugin (v0.10.0).
-- The custom mfa* columns are dropped: enrolments made through the old flow were
-- never enforced at login and must be redone. The twoFactor table gains the
-- verification and lockout columns the plugin writes.
ALTER TABLE "public"."user"
  DROP COLUMN IF EXISTS "mfaEnabled",
  DROP COLUMN IF EXISTS "mfaSecret",
  DROP COLUMN IF EXISTS "mfaBackupCodes";

ALTER TABLE "public"."twoFactor"
  ADD COLUMN IF NOT EXISTS "verified" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMPTZ(6);
