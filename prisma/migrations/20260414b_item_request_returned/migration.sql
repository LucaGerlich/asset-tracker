-- Add returnedAt column to item_requests
ALTER TABLE "public"."item_requests" ADD COLUMN "returnedAt" TIMESTAMP(6);
