-- Partial unique index: only one active request per entity+user
-- Terminal statuses (returned, rejected, cancelled) are excluded,
-- so a user can only have one pending/approved/return_pending request per item.
CREATE UNIQUE INDEX "item_requests_active_unique"
ON "public"."item_requests"("entityType", "entityId")
WHERE "status" NOT IN ('returned', 'rejected', 'cancelled');
