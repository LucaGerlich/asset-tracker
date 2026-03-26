SET search_path TO "assettool";

CREATE TABLE IF NOT EXISTS "asset_templates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "assetcategorytypeid" UUID REFERENCES "assetCategoryType"("assetcategorytypeid"),
  "manufacturerid" UUID REFERENCES "manufacturer"("manufacturerid"),
  "modelid" UUID REFERENCES "model"("modelid"),
  "statustypeid" UUID REFERENCES "statusType"("statustypeid"),
  "locationid" UUID REFERENCES "location"("locationid"),
  "supplierid" UUID REFERENCES "supplier"("supplierid"),
  "defaultSpecs" TEXT,
  "defaultNotes" TEXT,
  "isActive" BOOLEAN DEFAULT true,
  "organizationId" UUID REFERENCES "organizations"("id") ON DELETE CASCADE,
  "createdBy" UUID REFERENCES "user"("userid"),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_templates_org ON "asset_templates" ("organizationId");
