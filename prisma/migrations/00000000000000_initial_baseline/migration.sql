CREATE SCHEMA IF NOT EXISTS "assettool";
SET search_path TO "assettool";
-- CreateSchema
-- Schema is managed by Prisma via DATABASE_URL ?schema= parameter

-- CreateTable
CREATE TABLE "accessorieCategoryType" (
    "accessoriecategorytypeid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "accessoriecategorytypename" VARCHAR NOT NULL,

    CONSTRAINT "accessorieCategoryType_pkey" PRIMARY KEY ("accessoriecategorytypeid")
);

-- CreateTable
CREATE TABLE "accessories" (
    "accessorieid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "accessoriename" VARCHAR NOT NULL,
    "accessorietag" VARCHAR NOT NULL,
    "purchaseprice" DECIMAL(10,2),
    "purchasedate" DATE,
    "requestable" BOOLEAN,
    "manufacturerid" UUID NOT NULL,
    "statustypeid" UUID NOT NULL,
    "accessoriecategorytypeid" UUID NOT NULL,
    "locationid" UUID NOT NULL,
    "supplierid" UUID NOT NULL,
    "modelid" UUID NOT NULL,
    "creation_date" TIMESTAMP(6) NOT NULL,
    "change_date" TIMESTAMP(6),

    CONSTRAINT "accessories_pkey" PRIMARY KEY ("accessorieid")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset" (
    "assetid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assetname" VARCHAR NOT NULL,
    "assettag" VARCHAR NOT NULL,
    "serialnumber" VARCHAR NOT NULL,
    "modelid" UUID,
    "specs" TEXT,
    "notes" TEXT,
    "purchaseprice" DECIMAL(10,2),
    "purchasedate" DATE,
    "mobile" BOOLEAN,
    "requestable" BOOLEAN,
    "assetcategorytypeid" UUID,
    "statustypeid" UUID,
    "supplierid" UUID,
    "locationid" UUID,
    "manufacturerid" UUID,
    "creation_date" TIMESTAMP(6) NOT NULL,
    "change_date" TIMESTAMP(6),
    "expectedEndOfLife" DATE,
    "warrantyExpires" DATE,
    "warrantyMonths" INTEGER,

    CONSTRAINT "asset_pkey" PRIMARY KEY ("assetid")
);

-- CreateTable
CREATE TABLE "assetCategoryType" (
    "assetcategorytypeid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assetcategorytypename" VARCHAR NOT NULL,

    CONSTRAINT "assetCategoryType_pkey" PRIMARY KEY ("assetcategorytypeid")
);

-- CreateTable
CREATE TABLE "asset_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assetId" UUID NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "uploadedBy" UUID,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID,
    "action" VARCHAR(50) NOT NULL,
    "entity" VARCHAR(50) NOT NULL,
    "entityId" UUID,
    "details" TEXT,
    "ipAddress" VARCHAR(50),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumable" (
    "consumableid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "consumablename" VARCHAR NOT NULL,
    "consumablecategorytypeid" UUID NOT NULL,
    "manufacturerid" UUID NOT NULL,
    "supplierid" UUID NOT NULL,
    "purchaseprice" DECIMAL(10,2),
    "purchasedate" DATE,
    "creation_date" TIMESTAMP(6) NOT NULL,
    "change_date" TIMESTAMP(6),
    "minQuantity" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "consumable_pkey" PRIMARY KEY ("consumableid")
);

-- CreateTable
CREATE TABLE "consumableCategoryType" (
    "consumablecategorytypeid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "consumablecategorytypename" VARCHAR NOT NULL,

    CONSTRAINT "consumableCategoryType_pkey" PRIMARY KEY ("consumablecategorytypeid")
);

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "fieldType" VARCHAR(20) NOT NULL,
    "options" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "entityType" VARCHAR(50) NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_values" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fieldId" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "value" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depreciation_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "categoryId" UUID NOT NULL,
    "method" VARCHAR(30) NOT NULL,
    "usefulLifeYears" INTEGER NOT NULL DEFAULT 5,
    "salvagePercent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "depreciation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "variables" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "label_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "width" DECIMAL(5,2) NOT NULL,
    "height" DECIMAL(5,2) NOT NULL,
    "layout" TEXT NOT NULL,
    "includeQR" BOOLEAN NOT NULL DEFAULT true,
    "includeLogo" BOOLEAN NOT NULL DEFAULT false,
    "fields" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "label_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licence" (
    "licenceid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "licencekey" VARCHAR,
    "licenceduserid" UUID,
    "licensedtoemail" VARCHAR,
    "purchaseprice" DECIMAL(10,2),
    "purchasedate" DATE,
    "expirationdate" DATE,
    "notes" TEXT,
    "requestable" BOOLEAN,
    "licencecategorytypeid" UUID NOT NULL,
    "manufacturerid" UUID NOT NULL,
    "supplierid" UUID NOT NULL,
    "creation_date" TIMESTAMP(6) NOT NULL,
    "change_date" TIMESTAMP(6),

    CONSTRAINT "licence_pkey" PRIMARY KEY ("licenceid")
);

-- CreateTable
CREATE TABLE "licenceCategoryType" (
    "licencecategorytypeid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "licencecategorytypename" VARCHAR NOT NULL,

    CONSTRAINT "licenceCategoryType_pkey" PRIMARY KEY ("licencecategorytypeid")
);

-- CreateTable
CREATE TABLE "location" (
    "locationid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "locationname" VARCHAR,
    "street" VARCHAR,
    "housenumber" VARCHAR,
    "city" VARCHAR,
    "country" VARCHAR,
    "creation_date" TIMESTAMP(6) NOT NULL,
    "change_date" TIMESTAMP(6),

    CONSTRAINT "location_pkey" PRIMARY KEY ("locationid")
);

-- CreateTable
CREATE TABLE "maintenance_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scheduleId" UUID NOT NULL,
    "completedBy" UUID,
    "completedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "actualCost" DECIMAL(10,2),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assetId" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "frequency" VARCHAR(20) NOT NULL,
    "nextDueDate" DATE NOT NULL,
    "lastCompletedAt" TIMESTAMP(6),
    "assignedTo" UUID,
    "estimatedCost" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "maintenance_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manufacturer" (
    "manufacturerid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "manufacturername" VARCHAR NOT NULL,
    "creation_date" TIMESTAMP(6) NOT NULL,
    "change_date" TIMESTAMP(6),

    CONSTRAINT "manufacturer_pkey" PRIMARY KEY ("manufacturerid")
);

-- CreateTable
CREATE TABLE "model" (
    "modelid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "modelname" VARCHAR NOT NULL,
    "modelnumber" VARCHAR,
    "creation_date" TIMESTAMP(6) NOT NULL,
    "change_date" TIMESTAMP(6),

    CONSTRAINT "model_pkey" PRIMARY KEY ("modelid")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "emailAssignments" BOOLEAN NOT NULL DEFAULT true,
    "emailUnassignments" BOOLEAN NOT NULL DEFAULT true,
    "emailLicenseExpiry" BOOLEAN NOT NULL DEFAULT true,
    "emailMaintenanceDue" BOOLEAN NOT NULL DEFAULT true,
    "emailLowStock" BOOLEAN NOT NULL DEFAULT false,
    "licenseExpiryDays" INTEGER NOT NULL DEFAULT 30,
    "maintenanceReminderDays" INTEGER NOT NULL DEFAULT 7,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_queue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID,
    "type" VARCHAR(50) NOT NULL,
    "recipient" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "scheduledAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_filters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "entity" VARCHAR(50) NOT NULL,
    "filters" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "saved_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sessionToken" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statusType" (
    "statustypeid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "statustypename" VARCHAR NOT NULL,

    CONSTRAINT "statusType_pkey" PRIMARY KEY ("statustypeid")
);

-- CreateTable
CREATE TABLE "supplier" (
    "supplierid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "suppliername" VARCHAR NOT NULL,
    "lastname" VARCHAR,
    "firstname" VARCHAR,
    "salutation" VARCHAR,
    "email" VARCHAR,
    "phonenumber" VARCHAR,
    "creation_date" TIMESTAMP(6) NOT NULL,
    "change_date" TIMESTAMP(6),

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("supplierid")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "settingKey" VARCHAR(100) NOT NULL,
    "settingValue" TEXT,
    "settingType" VARCHAR(20) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "userid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" VARCHAR,
    "isadmin" BOOLEAN NOT NULL,
    "canrequest" BOOLEAN NOT NULL,
    "lastname" VARCHAR NOT NULL,
    "firstname" VARCHAR NOT NULL,
    "email" VARCHAR,
    "lan" VARCHAR,
    "password" VARCHAR NOT NULL,
    "creation_date" TIMESTAMP(6) NOT NULL,
    "change_date" TIMESTAMP(6),

    CONSTRAINT "user_pkey" PRIMARY KEY ("userid")
);

-- CreateTable
CREATE TABLE "userAccessoires" (
    "useraccessoiresid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userid" UUID NOT NULL,
    "accessorieid" UUID NOT NULL,
    "creation_date" TIMESTAMP(6) NOT NULL,
    "change_date" TIMESTAMP(6),

    CONSTRAINT "userAccessoires_pkey" PRIMARY KEY ("useraccessoiresid")
);

-- CreateTable
CREATE TABLE "userAssets" (
    "userassetsid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userid" UUID NOT NULL,
    "assetid" UUID NOT NULL,
    "creation_date" TIMESTAMP(6) NOT NULL,
    "change_date" TIMESTAMP(6),

    CONSTRAINT "userAssets_pkey" PRIMARY KEY ("userassetsid")
);

-- CreateTable
CREATE TABLE "userHistory" (
    "historyid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referenceid" UUID,
    "referencetable" VARCHAR(20),
    "userid" UUID NOT NULL,
    "actionname" VARCHAR NOT NULL,
    "updatedate" DATE,
    "checkedout" DATE,
    "checkedin" DATE,
    "creation_date" TIMESTAMP(6) NOT NULL,
    "change_date" TIMESTAMP(6),

    CONSTRAINT "userHistory_pkey" PRIMARY KEY ("historyid")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider" ASC, "providerAccountId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "asset_assettag_key" ON "asset"("assettag" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "asset_serialnumber_key" ON "asset"("serialnumber" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_values_fieldId_entityId_key" ON "custom_field_values"("fieldId" ASC, "entityId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "depreciation_settings_categoryId_key" ON "depreciation_settings"("categoryId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_name_key" ON "email_templates"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "licence_licencekey_key" ON "licence"("licencekey" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_settingKey_key" ON "system_settings"("settingKey" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier" ASC, "token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token" ASC);

-- AddForeignKey
ALTER TABLE "accessories" ADD CONSTRAINT "fk_accessories_accessoriecategorytype_c_accessoriecategorytypei" FOREIGN KEY ("accessoriecategorytypeid") REFERENCES "accessorieCategoryType"("accessoriecategorytypeid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "accessories" ADD CONSTRAINT "fk_accessories_location_c_locationid" FOREIGN KEY ("locationid") REFERENCES "location"("locationid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "accessories" ADD CONSTRAINT "fk_accessories_manufacturer_c_manufacturerid" FOREIGN KEY ("manufacturerid") REFERENCES "manufacturer"("manufacturerid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "accessories" ADD CONSTRAINT "fk_accessories_model_c_modelid" FOREIGN KEY ("modelid") REFERENCES "model"("modelid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "accessories" ADD CONSTRAINT "fk_accessories_statustype_c_statustypeid" FOREIGN KEY ("statustypeid") REFERENCES "statusType"("statustypeid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "accessories" ADD CONSTRAINT "fk_accessories_supplier_c_supplierid" FOREIGN KEY ("supplierid") REFERENCES "supplier"("supplierid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("userid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "fk_asset_assetcategorytype_c_assetcategorytypeid" FOREIGN KEY ("assetcategorytypeid") REFERENCES "assetCategoryType"("assetcategorytypeid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "fk_asset_location_c_locationid" FOREIGN KEY ("locationid") REFERENCES "location"("locationid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "fk_asset_manufacturer_c_manufacturerid" FOREIGN KEY ("manufacturerid") REFERENCES "manufacturer"("manufacturerid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "fk_asset_model_c_modelid" FOREIGN KEY ("modelid") REFERENCES "model"("modelid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "fk_asset_statustype_c_statustypeid" FOREIGN KEY ("statustypeid") REFERENCES "statusType"("statustypeid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "fk_asset_supplier_c_supplierid" FOREIGN KEY ("supplierid") REFERENCES "supplier"("supplierid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "asset_attachments" ADD CONSTRAINT "asset_attachments_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("assetid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_attachments" ADD CONSTRAINT "asset_attachments_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "user"("userid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("userid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable" ADD CONSTRAINT "fk_consumable_consumablecategorytype_c_consumablecategorytypeid" FOREIGN KEY ("consumablecategorytypeid") REFERENCES "consumableCategoryType"("consumablecategorytypeid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "consumable" ADD CONSTRAINT "fk_consumable_manufacturer_c_manufacturerid" FOREIGN KEY ("manufacturerid") REFERENCES "manufacturer"("manufacturerid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "consumable" ADD CONSTRAINT "fk_consumable_supplier_c_supplierid" FOREIGN KEY ("supplierid") REFERENCES "supplier"("supplierid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "custom_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_settings" ADD CONSTRAINT "depreciation_settings_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "assetCategoryType"("assetcategorytypeid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licence" ADD CONSTRAINT "fk_licence_licencecategorytype_c_licencecategorytypeid" FOREIGN KEY ("licencecategorytypeid") REFERENCES "licenceCategoryType"("licencecategorytypeid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "licence" ADD CONSTRAINT "fk_licence_manufacturer_c_manufacturerid" FOREIGN KEY ("manufacturerid") REFERENCES "manufacturer"("manufacturerid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "licence" ADD CONSTRAINT "fk_licence_supplier_c_supplierid" FOREIGN KEY ("supplierid") REFERENCES "supplier"("supplierid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "licence" ADD CONSTRAINT "fk_licence_user_c_licenceduser_userid" FOREIGN KEY ("licenceduserid") REFERENCES "user"("userid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_completedBy_fkey" FOREIGN KEY ("completedBy") REFERENCES "user"("userid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "maintenance_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("assetid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "user"("userid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("userid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_queue" ADD CONSTRAINT "notification_queue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("userid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_filters" ADD CONSTRAINT "saved_filters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("userid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("userid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "userAccessoires" ADD CONSTRAINT "fk_useraccessoires_accessories_c_accessorieid" FOREIGN KEY ("accessorieid") REFERENCES "accessories"("accessorieid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "userAccessoires" ADD CONSTRAINT "fk_useraccessoires_user_c_userid" FOREIGN KEY ("userid") REFERENCES "user"("userid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "userAssets" ADD CONSTRAINT "fk_userassets_asset_c_assetid" FOREIGN KEY ("assetid") REFERENCES "asset"("assetid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "userAssets" ADD CONSTRAINT "fk_userassets_user_c_userid" FOREIGN KEY ("userid") REFERENCES "user"("userid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "userHistory" ADD CONSTRAINT "fk_userhistory_user_c_userid" FOREIGN KEY ("userid") REFERENCES "user"("userid") ON DELETE NO ACTION ON UPDATE NO ACTION;

