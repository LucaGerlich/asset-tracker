// Assembles the complete, database-free dataset of one demo tenant.

const { faker } = require("@faker-js/faker");
const { BASE_SEED } = require("./config");
const people = require("./people");
const reference = require("./reference");
const inventory = require("./inventory");
const activity = require("./activity");
const { buildAuditLogs } = require("./auditLogs");

/**
 * Insert order: every entry is `[prisma delegate, dataset key]`, parents
 * before children. The seed writes them with createMany in this order.
 */
const INSERT_PLAN = [
  ["organization", "organizations"],
  ["role", "roles"],
  ["department", "departments"],
  ["user", "users"],
  ["accounts", "accounts"],
  ["userRole", "userRoles"],
  ["manufacturer", "manufacturers"],
  ["supplier", "suppliers"],
  ["model", "models"],
  ["statusType", "statusTypes"],
  ["assetCategoryType", "assetCategories"],
  ["accessorieCategoryType", "accessoryCategories"],
  ["consumableCategoryType", "consumableCategories"],
  ["licenceCategoryType", "licenceCategories"],
  ["componentCategory", "componentCategories"],
  ["location", "locations"],
  ["asset", "assets"],
  ["userAssets", "userAssets"],
  ["accessories", "accessories"],
  ["userAccessoires", "userAccessories"],
  ["consumable", "consumables"],
  ["stockAlert", "stockAlerts"],
  ["component", "components"],
  ["componentCheckout", "componentCheckouts"],
  ["licence", "licences"],
  ["licenceSeatAssignment", "licenceSeats"],
  ["maintenance_schedules", "maintenanceSchedules"],
  ["maintenance_logs", "maintenanceLogs"],
  ["assetReservation", "reservations"],
  ["itemRequest", "itemRequests"],
  ["purchaseRequest", "purchaseRequests"],
  ["purchaseRequestItem", "purchaseRequestItems"],
  ["purchaseOrder", "purchaseOrders"],
  ["goodsReceipt", "goodsReceipts"],
  ["auditCampaign", "auditCampaigns"],
  ["auditCampaignAuditor", "auditCampaignAuditors"],
  ["auditEntry", "auditEntries"],
  ["custom_field_definitions", "customFieldDefinitions"],
  ["custom_field_values", "customFieldValues"],
  ["audit_logs", "auditLogs"],
];

/**
 * Builds all rows of one tenant. Pure: no database access, deterministic for
 * a given (definition, index, anchor).
 *
 * @param {object} def one entry of DEMO_ORGS
 * @param {number} orgIndex position in DEMO_ORGS, offsets the faker seed
 * @param {{ anchor: Date, passwordHash: string }} options
 */
function buildOrgDataset(def, orgIndex, { anchor, passwordHash }) {
  faker.seed(BASE_SEED + orgIndex);
  faker.setDefaultRefDate(anchor);

  const ctx = {
    def,
    anchor,
    passwordHash,
    orgId: faker.string.uuid(),
    catalog: reference.buildCatalog(def),
  };

  const roles = people.buildRoles(ctx);
  const departments = people.buildDepartments(ctx);
  const crew = people.buildPeople(ctx, departments.idByName, roles.idByKey);
  ctx.people = crew.people;

  const manufacturers = reference.buildManufacturers(ctx);
  const suppliers = reference.buildSuppliers(ctx);
  const models = reference.buildModels(ctx);
  const statuses = reference.buildStatusTypes(ctx);
  const categories = reference.buildCategories(ctx);
  const locations = reference.buildLocations(ctx);
  ctx.ref = {
    manufacturers,
    suppliers,
    models,
    statuses,
    categories,
    locations,
  };

  const assets = inventory.buildAssets(ctx);
  const accessories = inventory.buildAccessories(ctx);
  const consumables = inventory.buildConsumables(ctx);
  const components = inventory.buildComponents(ctx, assets.meta);
  const licences = inventory.buildLicences(ctx);

  const maintenance = activity.buildMaintenance(ctx, assets.meta);
  const reservations = activity.buildReservations(ctx, assets.meta);
  const itemRequests = activity.buildItemRequests(ctx, {
    assets: assets.meta,
    accessories: accessories.meta,
    consumables: consumables.meta,
    licences: licences.meta,
  });
  const procurement = activity.buildProcurement(ctx);
  const audit = activity.buildAuditCampaign(ctx, assets.meta);
  const customFields = activity.buildCustomFields(ctx, assets.meta);
  const auditLogs = buildAuditLogs(ctx, {
    assets: assets.meta,
    accessories: accessories.meta,
    licences: licences.meta,
    consumables: consumables.meta,
  });

  return {
    key: def.key,
    orgId: ctx.orgId,
    logins: crew.logins,
    data: {
      organizations: [people.buildOrganization(ctx)],
      roles: roles.rows,
      departments: departments.rows,
      users: crew.users,
      accounts: crew.accounts,
      userRoles: crew.userRoles,
      manufacturers: manufacturers.rows,
      suppliers: suppliers.rows,
      models: models.rows,
      statusTypes: statuses.rows,
      assetCategories: categories.asset.rows,
      accessoryCategories: categories.accessory.rows,
      consumableCategories: categories.consumable.rows,
      licenceCategories: categories.licence.rows,
      componentCategories: categories.component.rows,
      locations: locations.rows,
      assets: assets.rows,
      userAssets: assets.userAssets,
      accessories: accessories.rows,
      userAccessories: accessories.userAccessories,
      consumables: consumables.rows,
      stockAlerts: consumables.stockAlerts,
      components: components.rows,
      componentCheckouts: components.checkouts,
      licences: licences.rows,
      licenceSeats: licences.seats,
      maintenanceSchedules: maintenance.schedules,
      maintenanceLogs: maintenance.logs,
      reservations,
      itemRequests,
      purchaseRequests: procurement.requests,
      purchaseRequestItems: procurement.items,
      purchaseOrders: procurement.orders,
      goodsReceipts: procurement.receipts,
      auditCampaigns: [audit.campaign],
      auditCampaignAuditors: audit.auditors,
      auditEntries: audit.entries,
      customFieldDefinitions: customFields.definitions,
      customFieldValues: customFields.values,
      auditLogs,
    },
  };
}

module.exports = { INSERT_PLAN, buildOrgDataset };
