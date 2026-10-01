-- Create per-org SCIM token table
CREATE TABLE "public"."scim_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "token" VARCHAR(255) NOT NULL,
  "organizationId" UUID NOT NULL,
  "description" VARCHAR(255),
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" UUID,

  CONSTRAINT "scim_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "scim_tokens_organizationId_fkey"
    FOREIGN KEY ("organizationId")
    REFERENCES "public"."organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "scim_tokens_organizationId_idx" ON "public"."scim_tokens"("organizationId");

-- Migrate existing global SCIM token to per-org table (assign to first org)
INSERT INTO "public"."scim_tokens" ("token", "organizationId", "description")
SELECT
  s."settingValue",
  (SELECT id FROM "public"."organizations" LIMIT 1),
  'Migrated from global SCIM config'
FROM "public"."system_settings" s
WHERE s."settingKey" = 'scim.bearerToken'
  AND s."settingValue" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "public"."organizations");
