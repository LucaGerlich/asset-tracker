-- Report Schedules
CREATE TABLE "public"."report_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "organizationId" UUID,
    "reportType" VARCHAR(30) NOT NULL,
    "frequency" VARCHAR(10) NOT NULL,
    "format" VARCHAR(10) NOT NULL DEFAULT 'csv',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(6),
    "nextRunAt" TIMESTAMP(6) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "report_schedules_userId_idx" ON "public"."report_schedules"("userId");
CREATE INDEX "report_schedules_organizationId_idx" ON "public"."report_schedules"("organizationId");
CREATE INDEX "report_schedules_isActive_nextRunAt_idx" ON "public"."report_schedules"("isActive", "nextRunAt");

ALTER TABLE "public"."report_schedules" ADD CONSTRAINT "report_schedules_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "public"."user"("userid") ON DELETE CASCADE ON UPDATE CASCADE;

-- Temporary Access Expiry
ALTER TABLE "public"."user" ADD COLUMN "accessExpiresAt" TIMESTAMP(6);
CREATE INDEX "user_isActive_accessExpiresAt_idx" ON "public"."user"("isActive", "accessExpiresAt");
