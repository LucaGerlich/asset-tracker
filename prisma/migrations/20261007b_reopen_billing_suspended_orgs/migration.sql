-- Reopen organizations that the old Stripe webhook locked on cancellation.
--
-- On a cancelled subscription the webhook used to set "isActive" = false together
-- with "suspendedAt". The new status model keeps "isActive" for operator locks
-- only; billing suspension is expressed by "suspendedAt" alone and follows the
-- 14-day read-only grace rule. Organizations that carry a "suspendedAt" and were
-- switched off by that webhook would otherwise stay locked forever, so they are
-- reopened here and fall under the grace rule instead.
UPDATE "public"."organizations" SET "isActive" = true WHERE "suspendedAt" IS NOT NULL AND "isActive" = false;
