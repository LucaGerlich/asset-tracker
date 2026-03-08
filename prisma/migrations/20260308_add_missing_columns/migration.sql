-- Add missing columns and tables that exist in Prisma schema but were never migrated
CREATE SCHEMA IF NOT EXISTS "assettool";
SET search_path TO "assettool";

-- ============================================================
-- ALTER existing tables: add missing columns
-- ============================================================

-- Organization billing columns
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "plan" VARCHAR(20) NOT NULL DEFAULT 'starter';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "stripeCustomerId" VARCHAR(255);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" VARCHAR(255);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(6);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "maxAssets" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "maxUsers" INTEGER NOT NULL DEFAULT 3;

CREATE UNIQUE INDEX IF NOT EXISTS "organizations_stripeCustomerId_key" ON "organizations"("stripeCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_stripeSubscriptionId_key" ON "organizations"("stripeSubscriptionId");

-- Sessions columns (BetterAuth fields)
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "ipAddress" VARCHAR(45);
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "userAgent" VARCHAR(500);
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "deviceName" VARCHAR(100);
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "lastActive" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "isCurrent" BOOLEAN NOT NULL DEFAULT false;

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

-- Licence seat count
ALTER TABLE "licence" ADD COLUMN IF NOT EXISTS "seatCount" INTEGER NOT NULL DEFAULT 1;

-- AssetCategoryType EULA link
ALTER TABLE "assetCategoryType" ADD COLUMN IF NOT EXISTS "eulaTemplateId" UUID;

-- ============================================================
-- CREATE missing tables
-- ============================================================

-- Asset Check-in/Check-out
CREATE TABLE IF NOT EXISTS "asset_checkouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assetId" UUID NOT NULL,
    "checkedOutToType" VARCHAR(20) NOT NULL DEFAULT 'user',
    "checkedOutTo" UUID,
    "checkedOutToLocationId" UUID,
    "checkedOutToAssetId" UUID,
    "checkedOutBy" UUID NOT NULL,
    "checkoutDate" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedReturn" TIMESTAMP(6),
    "returnDate" TIMESTAMP(6),
    "notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'checked_out',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "asset_checkouts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "asset_checkouts_assetId_idx" ON "asset_checkouts"("assetId");
CREATE INDEX IF NOT EXISTS "asset_checkouts_checkedOutTo_idx" ON "asset_checkouts"("checkedOutTo");
CREATE INDEX IF NOT EXISTS "asset_checkouts_checkedOutToLocationId_idx" ON "asset_checkouts"("checkedOutToLocationId");
CREATE INDEX IF NOT EXISTS "asset_checkouts_checkedOutToAssetId_idx" ON "asset_checkouts"("checkedOutToAssetId");
CREATE INDEX IF NOT EXISTS "asset_checkouts_status_idx" ON "asset_checkouts"("status");
CREATE INDEX IF NOT EXISTS "asset_checkouts_assetId_status_idx" ON "asset_checkouts"("assetId", "status");

-- Asset Transfers
CREATE TABLE IF NOT EXISTS "asset_transfers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assetId" UUID NOT NULL,
    "transferType" VARCHAR(20) NOT NULL,
    "fromUserId" UUID,
    "toUserId" UUID,
    "fromLocationId" UUID,
    "toLocationId" UUID,
    "fromOrgId" UUID,
    "toOrgId" UUID,
    "reason" TEXT,
    "transferredBy" UUID NOT NULL,
    "transferredAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asset_transfers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "asset_transfers_assetId_idx" ON "asset_transfers"("assetId");
CREATE INDEX IF NOT EXISTS "asset_transfers_transferredAt_idx" ON "asset_transfers"("transferredAt");

-- Approval Requests
CREATE TABLE IF NOT EXISTS "approval_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "approverId" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "resolvedAt" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "approval_requests_requesterId_idx" ON "approval_requests"("requesterId");
CREATE INDEX IF NOT EXISTS "approval_requests_status_idx" ON "approval_requests"("status");
CREATE INDEX IF NOT EXISTS "approval_requests_approverId_idx" ON "approval_requests"("approverId");

-- Automation Rules
CREATE TABLE IF NOT EXISTS "automation_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "trigger" VARCHAR(50) NOT NULL,
    "conditions" TEXT NOT NULL,
    "actions" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(6),
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "automation_rules_trigger_idx" ON "automation_rules"("trigger");
CREATE INDEX IF NOT EXISTS "automation_rules_isActive_idx" ON "automation_rules"("isActive");

-- Component Categories
CREATE TABLE IF NOT EXISTS "component_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    CONSTRAINT "component_categories_pkey" PRIMARY KEY ("id")
);

-- Components
CREATE TABLE IF NOT EXISTS "components" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "serialNumber" VARCHAR(255),
    "categoryId" UUID NOT NULL,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "remainingQuantity" INTEGER NOT NULL DEFAULT 0,
    "purchasePrice" DECIMAL(10,2),
    "purchaseDate" DATE,
    "minQuantity" INTEGER NOT NULL DEFAULT 0,
    "manufacturerId" UUID,
    "supplierId" UUID,
    "locationId" UUID,
    "organizationId" UUID,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "components_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "components_categoryId_idx" ON "components"("categoryId");
CREATE INDEX IF NOT EXISTS "components_organizationId_idx" ON "components"("organizationId");
CREATE INDEX IF NOT EXISTS "components_manufacturerId_idx" ON "components"("manufacturerId");
CREATE INDEX IF NOT EXISTS "components_supplierId_idx" ON "components"("supplierId");
CREATE INDEX IF NOT EXISTS "components_locationId_idx" ON "components"("locationId");

-- Component Checkouts
CREATE TABLE IF NOT EXISTS "component_checkouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "componentId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "checkedOutBy" UUID NOT NULL,
    "checkedOutAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(6),
    "notes" TEXT,
    CONSTRAINT "component_checkouts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "component_checkouts_componentId_idx" ON "component_checkouts"("componentId");
CREATE INDEX IF NOT EXISTS "component_checkouts_assetId_idx" ON "component_checkouts"("assetId");

-- Licence Seat Assignments
CREATE TABLE IF NOT EXISTS "licence_seat_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "licenceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" UUID,
    "unassignedAt" TIMESTAMP(6),
    "notes" TEXT,
    CONSTRAINT "licence_seat_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "licence_seat_assignments_licenceId_seatNumber_key" ON "licence_seat_assignments"("licenceId", "seatNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "licence_seat_assignments_licenceId_userId_key" ON "licence_seat_assignments"("licenceId", "userId");
CREATE INDEX IF NOT EXISTS "licence_seat_assignments_licenceId_idx" ON "licence_seat_assignments"("licenceId");
CREATE INDEX IF NOT EXISTS "licence_seat_assignments_userId_idx" ON "licence_seat_assignments"("userId");

-- EULA Templates
CREATE TABLE IF NOT EXISTS "eula_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" UUID,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "eula_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "eula_templates_organizationId_idx" ON "eula_templates"("organizationId");
CREATE INDEX IF NOT EXISTS "eula_templates_isActive_idx" ON "eula_templates"("isActive");

-- EULA Acceptances
CREATE TABLE IF NOT EXISTS "eula_acceptances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eulaTemplateId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "checkoutId" UUID NOT NULL,
    "signatureData" TEXT,
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "acceptedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "eula_acceptances_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "eula_acceptances_checkoutId_key" ON "eula_acceptances"("checkoutId");
CREATE INDEX IF NOT EXISTS "eula_acceptances_eulaTemplateId_idx" ON "eula_acceptances"("eulaTemplateId");
CREATE INDEX IF NOT EXISTS "eula_acceptances_userId_idx" ON "eula_acceptances"("userId");
CREATE INDEX IF NOT EXISTS "eula_acceptances_checkoutId_idx" ON "eula_acceptances"("checkoutId");

-- Kits
CREATE TABLE IF NOT EXISTS "kits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" UUID,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "kits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "kits_organizationId_idx" ON "kits"("organizationId");
CREATE INDEX IF NOT EXISTS "kits_isActive_idx" ON "kits"("isActive");

-- Kit Items
CREATE TABLE IF NOT EXISTS "kit_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kitId" UUID NOT NULL,
    "entityType" VARCHAR(30) NOT NULL,
    "entityId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    CONSTRAINT "kit_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "kit_items_kitId_idx" ON "kit_items"("kitId");

-- Audit Campaigns
CREATE TABLE IF NOT EXISTS "audit_campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "startDate" TIMESTAMP(6),
    "dueDate" TIMESTAMP(6),
    "completedAt" TIMESTAMP(6),
    "organizationId" UUID,
    "createdBy" UUID NOT NULL,
    "scopeType" VARCHAR(20) NOT NULL DEFAULT 'all',
    "scopeId" UUID,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "audit_campaigns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "audit_campaigns_organizationId_idx" ON "audit_campaigns"("organizationId");
CREATE INDEX IF NOT EXISTS "audit_campaigns_status_idx" ON "audit_campaigns"("status");
CREATE INDEX IF NOT EXISTS "audit_campaigns_createdBy_idx" ON "audit_campaigns"("createdBy");

-- Audit Campaign Auditors
CREATE TABLE IF NOT EXISTS "audit_campaign_auditors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaignId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    CONSTRAINT "audit_campaign_auditors_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "audit_campaign_auditors_campaignId_userId_key" ON "audit_campaign_auditors"("campaignId", "userId");

-- Audit Entries
CREATE TABLE IF NOT EXISTS "audit_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaignId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'unscanned',
    "auditedBy" UUID,
    "auditedAt" TIMESTAMP(6),
    "locationId" UUID,
    "notes" TEXT,
    CONSTRAINT "audit_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "audit_entries_campaignId_assetId_key" ON "audit_entries"("campaignId", "assetId");
CREATE INDEX IF NOT EXISTS "audit_entries_campaignId_idx" ON "audit_entries"("campaignId");
CREATE INDEX IF NOT EXISTS "audit_entries_assetId_idx" ON "audit_entries"("assetId");
CREATE INDEX IF NOT EXISTS "audit_entries_status_idx" ON "audit_entries"("status");

-- Team Invitations
CREATE TABLE IF NOT EXISTS "team_invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "organizationId" UUID NOT NULL,
    "roleId" UUID,
    "invitedBy" UUID NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(6) NOT NULL,
    "acceptedAt" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "team_invitations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "team_invitations_token_key" ON "team_invitations"("token");
CREATE INDEX IF NOT EXISTS "team_invitations_organizationId_idx" ON "team_invitations"("organizationId");
CREATE INDEX IF NOT EXISTS "team_invitations_email_idx" ON "team_invitations"("email");
CREATE INDEX IF NOT EXISTS "team_invitations_token_idx" ON "team_invitations"("token");
CREATE INDEX IF NOT EXISTS "team_invitations_status_idx" ON "team_invitations"("status");

-- LDAP Sync Logs
CREATE TABLE IF NOT EXISTS "ldap_sync_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "status" VARCHAR(20) NOT NULL,
    "usersCreated" INTEGER NOT NULL DEFAULT 0,
    "usersUpdated" INTEGER NOT NULL DEFAULT 0,
    "usersDeactivated" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "triggeredBy" VARCHAR(50),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ldap_sync_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ldap_sync_logs_createdAt_idx" ON "ldap_sync_logs"("createdAt");

-- Dashboard Widgets
CREATE TABLE IF NOT EXISTS "dashboard_widgets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "widgetType" VARCHAR(50) NOT NULL,
    "position" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "dashboard_widgets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "dashboard_widgets_userId_idx" ON "dashboard_widgets"("userId");
CREATE INDEX IF NOT EXISTS "dashboard_widgets_userId_position_idx" ON "dashboard_widgets"("userId", "position");

-- User Preferences
CREATE TABLE IF NOT EXISTS "user_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "theme" VARCHAR(20) NOT NULL DEFAULT 'system',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "dateFormat" VARCHAR(20) NOT NULL DEFAULT 'MM/DD/YYYY',
    "numberFormat" VARCHAR(20) NOT NULL DEFAULT '1,234.56',
    "pageSize" INTEGER NOT NULL DEFAULT 20,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "dashboardLayout" JSONB,
    "helpDismissed" JSONB,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_preferences_userId_key" ON "user_preferences"("userId");

-- Consumable Checkouts
CREATE TABLE IF NOT EXISTS "consumable_checkouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "consumableId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "checkedOutAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "consumable_checkouts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "consumable_checkouts_consumableId_idx" ON "consumable_checkouts"("consumableId");
CREATE INDEX IF NOT EXISTS "consumable_checkouts_userId_idx" ON "consumable_checkouts"("userId");

-- ============================================================
-- Foreign keys for new tables
-- ============================================================

-- asset_checkouts
ALTER TABLE "asset_checkouts" ADD CONSTRAINT "asset_checkouts_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("assetid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_checkouts" ADD CONSTRAINT "asset_checkouts_checkedOutTo_fkey" FOREIGN KEY ("checkedOutTo") REFERENCES "user"("userid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_checkouts" ADD CONSTRAINT "asset_checkouts_checkedOutToLocationId_fkey" FOREIGN KEY ("checkedOutToLocationId") REFERENCES "location"("locationid") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_checkouts" ADD CONSTRAINT "asset_checkouts_checkedOutToAssetId_fkey" FOREIGN KEY ("checkedOutToAssetId") REFERENCES "asset"("assetid") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_checkouts" ADD CONSTRAINT "asset_checkouts_checkedOutBy_fkey" FOREIGN KEY ("checkedOutBy") REFERENCES "user"("userid") ON DELETE CASCADE ON UPDATE CASCADE;

-- asset_transfers
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("assetid") ON DELETE CASCADE ON UPDATE CASCADE;

-- approval_requests
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "user"("userid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "user"("userid") ON DELETE SET NULL ON UPDATE CASCADE;

-- automation_rules
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("userid") ON DELETE CASCADE ON UPDATE CASCADE;

-- components
ALTER TABLE "components" ADD CONSTRAINT "components_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "component_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "components" ADD CONSTRAINT "components_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "manufacturer"("manufacturerid") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "components" ADD CONSTRAINT "components_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("supplierid") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "components" ADD CONSTRAINT "components_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "location"("locationid") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "components" ADD CONSTRAINT "components_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- component_checkouts
ALTER TABLE "component_checkouts" ADD CONSTRAINT "component_checkouts_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "components"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "component_checkouts" ADD CONSTRAINT "component_checkouts_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("assetid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "component_checkouts" ADD CONSTRAINT "component_checkouts_checkedOutBy_fkey" FOREIGN KEY ("checkedOutBy") REFERENCES "user"("userid") ON DELETE SET NULL ON UPDATE CASCADE;

-- licence_seat_assignments
ALTER TABLE "licence_seat_assignments" ADD CONSTRAINT "licence_seat_assignments_licenceId_fkey" FOREIGN KEY ("licenceId") REFERENCES "licence"("licenceid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "licence_seat_assignments" ADD CONSTRAINT "licence_seat_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("userid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "licence_seat_assignments" ADD CONSTRAINT "licence_seat_assignments_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "user"("userid") ON DELETE SET NULL ON UPDATE CASCADE;

-- eula_templates
ALTER TABLE "eula_templates" ADD CONSTRAINT "eula_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- eula_acceptances
ALTER TABLE "eula_acceptances" ADD CONSTRAINT "eula_acceptances_eulaTemplateId_fkey" FOREIGN KEY ("eulaTemplateId") REFERENCES "eula_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eula_acceptances" ADD CONSTRAINT "eula_acceptances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("userid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eula_acceptances" ADD CONSTRAINT "eula_acceptances_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "asset_checkouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- assetCategoryType -> eula_templates FK
ALTER TABLE "assetCategoryType" ADD CONSTRAINT "assetCategoryType_eulaTemplateId_fkey" FOREIGN KEY ("eulaTemplateId") REFERENCES "eula_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- kits
ALTER TABLE "kits" ADD CONSTRAINT "kits_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- kit_items
ALTER TABLE "kit_items" ADD CONSTRAINT "kit_items_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "kits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- audit_campaigns
ALTER TABLE "audit_campaigns" ADD CONSTRAINT "audit_campaigns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_campaigns" ADD CONSTRAINT "audit_campaigns_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("userid") ON DELETE SET NULL ON UPDATE CASCADE;

-- audit_campaign_auditors
ALTER TABLE "audit_campaign_auditors" ADD CONSTRAINT "audit_campaign_auditors_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "audit_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_campaign_auditors" ADD CONSTRAINT "audit_campaign_auditors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("userid") ON DELETE CASCADE ON UPDATE CASCADE;

-- audit_entries
ALTER TABLE "audit_entries" ADD CONSTRAINT "audit_entries_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "audit_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_entries" ADD CONSTRAINT "audit_entries_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("assetid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_entries" ADD CONSTRAINT "audit_entries_auditedBy_fkey" FOREIGN KEY ("auditedBy") REFERENCES "user"("userid") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_entries" ADD CONSTRAINT "audit_entries_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "location"("locationid") ON DELETE SET NULL ON UPDATE CASCADE;

-- team_invitations
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "user"("userid") ON DELETE CASCADE ON UPDATE CASCADE;

-- dashboard_widgets
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("userid") ON DELETE CASCADE ON UPDATE CASCADE;

-- user_preferences
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("userid") ON DELETE CASCADE ON UPDATE CASCADE;

-- consumable_checkouts
ALTER TABLE "consumable_checkouts" ADD CONSTRAINT "consumable_checkouts_consumableId_fkey" FOREIGN KEY ("consumableId") REFERENCES "consumable"("consumableid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consumable_checkouts" ADD CONSTRAINT "consumable_checkouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("userid") ON DELETE SET NULL ON UPDATE CASCADE;
