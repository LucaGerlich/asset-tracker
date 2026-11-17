// Reference data of a tenant: catalog selection, manufacturers, suppliers,
// models, status types, categories and the location hierarchy.

const { faker } = require("@faker-js/faker");
const config = require("./config");
const { uuid, daysBefore, int, pick } = require("./util");

const REFERENCE_AGE_DAYS = 3 * 365;

/** The industry-specific and shared catalog entries one tenant draws from. */
function buildCatalog(def) {
  const industry = def.industry;
  return {
    assets: [...config.COMMON_ASSETS, ...config.INDUSTRY_ASSETS[industry]],
    accessories: config.COMMON_ACCESSORIES,
    consumables: [
      ...config.COMMON_CONSUMABLES,
      ...config.INDUSTRY_CONSUMABLES[industry],
    ],
    components: [
      ...config.COMMON_COMPONENTS,
      ...config.INDUSTRY_COMPONENTS[industry],
    ],
    licences: [
      ...config.INDUSTRY_LICENCES[industry],
      ...config.COMMON_LICENCES,
    ].slice(0, def.counts.licences),
    customFields: config.CUSTOM_FIELDS[industry],
  };
}

function uniqueNames(...lists) {
  return [...new Set(lists.flat())];
}

function buildManufacturers(ctx) {
  const { catalog } = ctx;
  const names = uniqueNames(
    catalog.assets.map((entry) => entry.manufacturer),
    catalog.accessories.map((entry) => entry.manufacturer),
    catalog.consumables.map((entry) => entry.manufacturer),
    catalog.components.map((entry) => entry.manufacturer),
    catalog.licences.map((entry) => entry.manufacturer),
  );
  const idByName = {};
  /** @type {import("@prisma/client").Prisma.manufacturerCreateManyInput[]} */
  const rows = names.map((name) => {
    const id = uuid();
    idByName[name] = id;
    return {
      manufacturerid: id,
      manufacturername: name,
      organizationId: ctx.orgId,
      creation_date: daysBefore(ctx.anchor, REFERENCE_AGE_DAYS),
    };
  });
  return { rows, idByName };
}

function buildSuppliers(ctx) {
  /** @type {import("@prisma/client").Prisma.supplierCreateManyInput[]} */
  const rows = config.SUPPLIER_NAMES.slice(0, 5).map((name) => {
    const firstname = faker.person.firstName();
    const lastname = faker.person.lastName();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
    return {
      supplierid: uuid(),
      suppliername: name,
      firstname,
      lastname,
      salutation: pick(["Mr.", "Ms."]),
      email: `sales@${slug}.example`,
      phonenumber: faker.phone.number({ style: "international" }),
      website: `https://www.${slug}.example`,
      organizationId: ctx.orgId,
      creation_date: daysBefore(ctx.anchor, REFERENCE_AGE_DAYS),
    };
  });
  return { rows, ids: rows.map((row) => row.supplierid) };
}

/** One model per asset and accessory catalog entry. */
function buildModels(ctx) {
  const modelIdByEntry = new Map();
  /** @type {import("@prisma/client").Prisma.modelCreateManyInput[]} */
  const rows = [];
  for (const entry of [...ctx.catalog.assets, ...ctx.catalog.accessories]) {
    const id = uuid();
    modelIdByEntry.set(entry, id);
    rows.push({
      modelid: id,
      modelname: entry.model,
      modelnumber: entry.number,
      organizationId: ctx.orgId,
      creation_date: daysBefore(ctx.anchor, REFERENCE_AGE_DAYS),
    });
  }
  return { rows, modelIdByEntry };
}

function buildStatusTypes(ctx) {
  const idByName = {};
  /** @type {import("@prisma/client").Prisma.statusTypeCreateManyInput[]} */
  const rows = config.STATUS_TYPES.map((status) => {
    const id = uuid();
    idByName[status.name] = id;
    return {
      statustypeid: id,
      statustypename: status.name,
      color: status.color,
      isDefault: status.isDefault,
      organizationId: ctx.orgId,
    };
  });
  return { rows, idByName };
}

function categoryRows(names, idKey, nameKey, orgId) {
  const idByName = {};
  const rows = names.map((name) => {
    const id = uuid();
    idByName[name] = id;
    return { [idKey]: id, [nameKey]: name, organizationId: orgId };
  });
  return { rows, idByName };
}

function buildCategories(ctx) {
  const { catalog, orgId } = ctx;
  const assetNames = uniqueNames(
    config.ASSET_CATEGORIES,
    catalog.assets.map((entry) => entry.category),
  );
  const component = categoryRows(
    config.COMPONENT_CATEGORIES,
    "id",
    "name",
    orgId,
  );
  return {
    asset: categoryRows(
      assetNames,
      "assetcategorytypeid",
      "assetcategorytypename",
      orgId,
    ),
    accessory: categoryRows(
      config.ACCESSORY_CATEGORIES,
      "accessoriecategorytypeid",
      "accessoriecategorytypename",
      orgId,
    ),
    consumable: categoryRows(
      config.CONSUMABLE_CATEGORIES,
      "consumablecategorytypeid",
      "consumablecategorytypename",
      orgId,
    ),
    licence: categoryRows(
      config.LICENCE_CATEGORIES,
      "licencecategorytypeid",
      "licencecategorytypename",
      orgId,
    ),
    component,
  };
}

/**
 * HQ with floors and rooms, plus branch sites with rooms. `leaves` are the
 * places equipment physically sits (rooms).
 */
function buildLocations(ctx) {
  const { def, orgId, anchor } = ctx;
  const created = daysBefore(anchor, REFERENCE_AGE_DAYS);
  /** @type {import("@prisma/client").Prisma.locationCreateManyInput[]} */
  const rows = [];
  const leaves = [];

  const addLocation = (fields) => {
    const row = {
      locationid: uuid(),
      street: faker.location.street(),
      housenumber: String(int(1, 120)),
      parentId: null,
      organizationId: orgId,
      creation_date: created,
      ...fields,
    };
    rows.push(row);
    return row;
  };

  const { hq, branches } = def.locations;
  const site = (source) => ({
    city: source.city,
    country: source.country,
    latitude: source.latitude,
    longitude: source.longitude,
  });

  const hqRow = addLocation({ locationname: hq.name, ...site(hq) });
  const floors = hq.floors.map((floor) =>
    addLocation({
      locationname: `${hq.name} - ${floor}`,
      parentId: hqRow.locationid,
      street: hqRow.street,
      housenumber: hqRow.housenumber,
      ...site(hq),
    }),
  );
  hq.rooms.forEach((room, index) => {
    const floor = floors[index % floors.length];
    const row = addLocation({
      locationname: `${room} (${floor.locationname.split(" - ")[1]})`,
      parentId: floor.locationid,
      street: hqRow.street,
      housenumber: hqRow.housenumber,
      ...site(hq),
    });
    leaves.push({ id: row.locationid, name: room, siteName: hq.name });
  });

  for (const branch of branches) {
    const branchRow = addLocation({
      locationname: branch.name,
      ...site(branch),
    });
    for (const room of branch.rooms) {
      const row = addLocation({
        locationname: `${branch.name} - ${room}`,
        parentId: branchRow.locationid,
        street: branchRow.street,
        housenumber: branchRow.housenumber,
        ...site(branch),
      });
      leaves.push({ id: row.locationid, name: room, siteName: branch.name });
    }
  }

  return { rows, leaves };
}

module.exports = {
  buildCatalog,
  buildManufacturers,
  buildSuppliers,
  buildModels,
  buildStatusTypes,
  buildCategories,
  buildLocations,
};
