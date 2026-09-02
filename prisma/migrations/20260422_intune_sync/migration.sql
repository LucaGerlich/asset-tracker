-- Asset external ID fields for MDM sync
ALTER TABLE "public"."asset" ADD COLUMN "externalId" VARCHAR(255);
ALTER TABLE "public"."asset" ADD COLUMN "externalSource" VARCHAR(30);
CREATE INDEX "asset_externalId_idx" ON "public"."asset"("externalId");
CREATE INDEX "asset_externalSource_idx" ON "public"."asset"("externalSource");

-- Intune sync log
CREATE TABLE "public"."intune_sync_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID,
    "status" VARCHAR(20) NOT NULL,
    "devicesCreated" INT NOT NULL DEFAULT 0,
    "devicesUpdated" INT NOT NULL DEFAULT 0,
    "devicesSkipped" INT NOT NULL DEFAULT 0,
    "errors" JSONB,
    "triggeredBy" VARCHAR(50),
    "durationMs" INT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intune_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "intune_sync_logs_createdAt_idx" ON "public"."intune_sync_logs"("createdAt");
