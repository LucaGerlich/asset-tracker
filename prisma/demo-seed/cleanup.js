// Removes the data of demo organizations (slug "demo-*") and nothing else.
//
// Every step below is a deleteMany whose `where` is anchored to the given
// demo organization ids, either through the row's own organizationId or
// through the relation that leads to it (asset, user, licence, ...). Rows of
// other organizations are never matched. If a foreign row still references a
// demo row, the database rejects the delete (RESTRICT) instead of silently
// removing it.

const { DEMO_SLUG_PREFIX } = require("./config");

const inOrgs = (orgIds) => ({ in: orgIds });
/** The row itself carries organizationId. */
const ownOrg = (orgIds) => ({ organizationId: inOrgs(orgIds) });
/** The row belongs to a relation that carries organizationId. */
const through = (relation, orgIds) => ({ [relation]: ownOrg(orgIds) });

/**
 * Deletion order: children before parents. Each entry is
 * `[prisma delegate, where builder]`. Exported so tests can inspect it.
 */
const CLEANUP_STEPS = [
  // Webhooks, procurement
  ["webhookDelivery", (ids) => through("webhook", ids)],
  ["webhook", ownOrg],
  ["goodsReceipt", (ids) => through("purchaseOrder", ids)],
  ["purchaseOrder", ownOrg],
  ["purchaseRequestItem", (ids) => through("purchaseRequest", ids)],
  ["purchaseRequest", ownOrg],
  // Checkouts, EULA signatures
  ["eulaAcceptance", (ids) => through("eulaTemplate", ids)],
  ["assetCheckout", (ids) => through("asset", ids)],
  ["componentCheckout", (ids) => through("component", ids)],
  // Audit campaigns
  ["auditEntry", (ids) => through("campaign", ids)],
  ["auditCampaignAuditor", (ids) => through("campaign", ids)],
  ["auditCampaign", ownOrg],
  // Licences
  ["licenceSeatAssignment", (ids) => through("licence", ids)],
  ["licence", ownOrg],
  // Consumables
  ["consumable_checkouts", (ids) => through("consumable", ids)],
  ["stockAlert", (ids) => through("consumable", ids)],
  ["consumable_attachments", (ids) => through("consumable", ids)],
  ["consumable", ownOrg],
  // Accessories
  ["userAccessoires", (ids) => through("accessories", ids)],
  ["accessory_attachments", (ids) => through("accessory", ids)],
  ["accessories", ownOrg],
  // Components
  ["component_attachments", (ids) => through("component", ids)],
  ["component", ownOrg],
  // Assets and everything hanging off them
  [
    "maintenance_logs",
    (ids) => ({ maintenance_schedules: through("asset", ids) }),
  ],
  ["maintenance_schedules", (ids) => through("asset", ids)],
  ["asset_attachments", (ids) => through("asset", ids)],
  ["assetReservation", (ids) => through("asset", ids)],
  ["assetTransfer", (ids) => through("asset", ids)],
  ["userAssets", (ids) => through("asset", ids)],
  ["asset", ownOrg],
  ["assetTemplate", ownOrg],
  // Custom fields, kits
  ["custom_field_values", (ids) => through("custom_field_definitions", ids)],
  ["custom_field_definitions", ownOrg],
  ["kitItem", (ids) => through("kit", ids)],
  ["kit", ownOrg],
  // Requests and approvals (no organization column: via the requesting user)
  ["itemRequest", (ids) => through("user", ids)],
  ["approvalRequest", (ids) => through("requester", ids)],
  // Reference data
  ["depreciation_settings", (ids) => through("assetCategoryType", ids)],
  ["status_transitions", (ids) => through("fromStatus", ids)],
  ["assetCategoryType", ownOrg],
  ["eulaTemplate", ownOrg],
  ["accessorieCategoryType", ownOrg],
  ["consumableCategoryType", ownOrg],
  ["licenceCategoryType", ownOrg],
  ["componentCategory", ownOrg],
  ["statusType", ownOrg],
  ["model", ownOrg],
  ["manufacturer", ownOrg],
  ["supplier", ownOrg],
  ["location", ownOrg],
  // User-owned rows (no organization column: via the user)
  ["userHistory", (ids) => through("user", ids)],
  ["audit_logs", (ids) => through("user", ids)],
  ["sessions", (ids) => through("user", ids)],
  ["accounts", (ids) => through("user", ids)],
  ["twoFactor", (ids) => through("user", ids)],
  ["apiKey", (ids) => through("user", ids)],
  ["dashboardWidget", (ids) => through("user", ids)],
  ["notification_preferences", (ids) => through("user", ids)],
  ["notification_queue", (ids) => through("user", ids)],
  ["saved_filters", (ids) => through("user", ids)],
  ["user_preferences", (ids) => through("user", ids)],
  ["importJob", (ids) => through("user", ids)],
  ["ticket_comments", (ids) => through("user", ids)],
  ["tickets", (ids) => through("user_tickets_createdByTouser", ids)],
  ["reportSchedule", ownOrg],
  ["teamInvitation", ownOrg],
  ["scimToken", ownOrg],
  ["automationRule", ownOrg],
  ["intuneSyncLog", ownOrg],
  ["organizationStorageConfig", ownOrg],
  // RBAC, people, organization
  ["userRole", (ids) => through("user", ids)],
  ["role", ownOrg],
  ["user", ownOrg],
  ["department", ownOrg],
];

/** Ids of the existing demo organizations. */
async function findDemoOrgIds(prisma) {
  const orgs = await prisma.organization.findMany({
    where: { slug: { startsWith: DEMO_SLUG_PREFIX } },
    select: { id: true },
  });
  return orgs.map((org) => org.id);
}

/**
 * Deletes all data of the given demo organizations, then the organizations.
 * Returns `[{ model, count }]` per step. Does nothing for an empty id list.
 */
async function cleanupDemoOrgs(prisma, orgIds) {
  if (!Array.isArray(orgIds) || orgIds.length === 0) return [];

  const results = [];
  for (const [model, buildWhere] of CLEANUP_STEPS) {
    const { count } = await prisma[model].deleteMany({
      where: buildWhere(orgIds),
    });
    results.push({ model, count });
  }
  const { count } = await prisma.organization.deleteMany({
    where: { id: inOrgs(orgIds) },
  });
  results.push({ model: "organization", count });
  return results;
}

module.exports = { CLEANUP_STEPS, findDemoOrgIds, cleanupDemoOrgs };
