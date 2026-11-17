// Equipment of a tenant: assets and their assignments, accessories,
// consumables, components and licences with seats.

const {
  uuid,
  int,
  chance,
  pick,
  sample,
  shuffle,
  money,
  weighted,
  daysBefore,
  daysAfter,
  clampDate,
  addMonths,
  dateOnly,
  padNumber,
} = require("./util");
const { faker } = require("@faker-js/faker");

const MAX_ASSETS_PER_USER = 6;
const ASSIGN_PROBABILITY = 0.5;
const ASSET_AGE_DAYS = { min: 7, max: 3 * 365 };

const ASSET_NOTES = [
  "Screen replaced under warranty.",
  "Sticker and asset label renewed.",
  "Battery health checked, still above 85 percent.",
  "Re-imaged after user left the company.",
  "Carrying case included.",
];

/** Picks the lifecycle status of one asset from its age and kind. */
function pickAssetStatus(entry, ageDays) {
  if (ageDays > 1000 && chance(0.06)) return "Disposed";
  if (ageDays > 900 && chance(0.3)) return "Retired";
  const roll = faker.number.float({ min: 0, max: 1 });
  if (roll < 0.06) return "Out for Repair";
  if (roll < 0.08) return "Lost/Stolen";
  if (roll < 0.1) return "In Transit";
  return entry.assignable ? "Available" : "Active";
}

/**
 * Assets are spread over three years of purchases. Assignable equipment is
 * handed to users through userAssets (status "Active", as the assign route
 * does); infrastructure is simply "Active" in its room.
 */
function buildAssets(ctx) {
  const { def, anchor, ref, people } = ctx;
  const catalog = ctx.catalog.assets.map((entry) => ({
    item: entry,
    weight: entry.weight,
  }));
  const assignees = shuffle([...people.managers, ...people.standard]);
  const assignedCount = new Map();

  /** @type {import("@prisma/client").Prisma.assetCreateManyInput[]} */
  const rows = [];
  /** @type {import("@prisma/client").Prisma.userAssetsCreateManyInput[]} */
  const userAssets = [];
  const meta = [];

  for (let index = 0; index < def.counts.assets; index += 1) {
    const entry = weighted(catalog);
    const ageDays = int(ASSET_AGE_DAYS.min, ASSET_AGE_DAYS.max);
    const purchase = daysBefore(anchor, ageDays);
    const created = clampDate(daysAfter(purchase, 1), anchor);
    let status = pickAssetStatus(entry, ageDays);

    let assignee = null;
    if (status === "Available" && chance(ASSIGN_PROBABILITY)) {
      assignee =
        shuffle(assignees).find(
          (user) => (assignedCount.get(user.userid) ?? 0) < MAX_ASSETS_PER_USER,
        ) ?? null;
      if (assignee) {
        status = "Active";
        assignedCount.set(
          assignee.userid,
          (assignedCount.get(assignee.userid) ?? 0) + 1,
        );
      }
    }

    const warrantyMonths = pick([24, 36, 36, 60]);
    const id = uuid();
    const locationId = pick(ref.locations.leaves).id;
    const requestable = entry.assignable && status === "Available";

    rows.push({
      assetid: id,
      assetname: `${entry.manufacturer} ${entry.model}`,
      assettag: `${def.tagPrefix}-${padNumber(index + 1, 5)}`,
      serialnumber: `${def.tagPrefix}${faker.string.alphanumeric({ length: 8, casing: "upper" })}${padNumber(index + 1, 4)}`,
      modelid: ref.models.modelIdByEntry.get(entry),
      specs: entry.specs,
      notes: chance(0.08) ? pick(ASSET_NOTES) : null,
      purchaseprice: money(entry.price[0], entry.price[1]),
      purchasedate: dateOnly(purchase),
      mobile: entry.mobile,
      requestable,
      assetcategorytypeid: ref.categories.asset.idByName[entry.category],
      statustypeid: ref.statuses.idByName[status],
      supplierid: pick(ref.suppliers.ids),
      locationid: locationId,
      manufacturerid: ref.manufacturers.idByName[entry.manufacturer],
      organizationId: ctx.orgId,
      creation_date: created,
      change_date: chance(0.3)
        ? clampDate(daysAfter(created, int(5, 200)), anchor)
        : null,
      expectedEndOfLife: dateOnly(addMonths(purchase, pick([48, 60]))),
      warrantyExpires: dateOnly(addMonths(purchase, warrantyMonths)),
      warrantyMonths,
    });

    if (assignee) {
      userAssets.push({
        userassetsid: uuid(),
        userid: assignee.userid,
        assetid: id,
        creation_date: clampDate(daysAfter(purchase, int(1, 30)), anchor),
      });
    }

    meta.push({
      id,
      entry,
      status,
      assigneeId: assignee?.userid ?? null,
      locationId,
      purchase,
      requestable,
      name: rows[rows.length - 1].assetname,
    });
  }

  return { rows, userAssets, meta };
}

function buildAccessories(ctx) {
  const { def, anchor, ref, people } = ctx;
  const assignees = shuffle([...people.managers, ...people.standard]);

  /** @type {import("@prisma/client").Prisma.accessoriesCreateManyInput[]} */
  const rows = [];
  /** @type {import("@prisma/client").Prisma.userAccessoiresCreateManyInput[]} */
  const userAccessories = [];
  const meta = [];

  for (let index = 0; index < def.counts.accessories; index += 1) {
    const entry =
      ctx.catalog.accessories[index % ctx.catalog.accessories.length];
    const purchase = daysBefore(anchor, int(7, 3 * 365));
    const created = clampDate(daysAfter(purchase, 1), anchor);
    const assigned = chance(0.5);
    const retired = !assigned && chance(0.08);
    const status = assigned ? "Active" : retired ? "Retired" : "Available";
    const id = uuid();

    rows.push({
      accessorieid: id,
      accessoriename: `${entry.manufacturer} ${entry.model}`,
      accessorietag: `${def.tagPrefix}-ACC-${padNumber(index + 1, 4)}`,
      purchaseprice: money(entry.price[0], entry.price[1]),
      purchasedate: dateOnly(purchase),
      requestable: status === "Available",
      manufacturerid: ref.manufacturers.idByName[entry.manufacturer],
      statustypeid: ref.statuses.idByName[status],
      accessoriecategorytypeid:
        ref.categories.accessory.idByName[entry.category],
      locationid: pick(ref.locations.leaves).id,
      supplierid: pick(ref.suppliers.ids),
      modelid: ref.models.modelIdByEntry.get(entry),
      organizationId: ctx.orgId,
      creation_date: created,
    });

    let assigneeId = null;
    if (assigned) {
      assigneeId = pick(assignees).userid;
      userAccessories.push({
        useraccessoiresid: uuid(),
        userid: assigneeId,
        accessorieid: id,
        creation_date: clampDate(daysAfter(purchase, int(1, 20)), anchor),
      });
    }
    meta.push({
      id,
      status,
      assigneeId,
      name: rows[rows.length - 1].accessoriename,
    });
  }

  return { rows, userAccessories, meta };
}

/** Every fourth consumable is below its minimum quantity. */
function buildConsumables(ctx) {
  const { anchor, ref } = ctx;
  /** @type {import("@prisma/client").Prisma.consumableCreateManyInput[]} */
  const rows = [];
  /** @type {import("@prisma/client").Prisma.StockAlertCreateManyInput[]} */
  const stockAlerts = [];
  const meta = [];

  ctx.catalog.consumables.forEach((entry, index) => {
    const minQuantity = int(entry.minimum[0], entry.minimum[1]);
    const belowMinimum = index % 4 === 1;
    const quantity = belowMinimum
      ? int(0, Math.max(0, minQuantity - 1))
      : Math.max(
          int(entry.quantity[0], entry.quantity[1]),
          minQuantity + int(1, 6),
        );
    const purchase = daysBefore(anchor, int(10, 400));
    const id = uuid();
    rows.push({
      consumableid: id,
      consumablename: entry.name,
      consumablecategorytypeid:
        ref.categories.consumable.idByName[entry.category],
      manufacturerid: ref.manufacturers.idByName[entry.manufacturer],
      supplierid: pick(ref.suppliers.ids),
      purchaseprice: money(entry.price[0], entry.price[1]),
      purchasedate: dateOnly(purchase),
      organizationId: ctx.orgId,
      creation_date: clampDate(daysAfter(purchase, 1), anchor),
      minQuantity,
      quantity,
    });
    stockAlerts.push({
      id: uuid(),
      consumableId: id,
      minThreshold: minQuantity,
      criticalThreshold: Math.floor(minQuantity / 2),
      emailNotify: true,
    });
    meta.push({ id, quantity, minQuantity, name: entry.name });
  });

  return { rows, stockAlerts, meta };
}

/**
 * Components are stock parts; some are checked out into assets. Total
 * quantity = remaining + currently checked out, so the books balance.
 */
function buildComponents(ctx, assetMeta) {
  const { anchor, ref, people } = ctx;
  const hostAssets = assetMeta.filter((asset) => asset.status === "Active");
  /** @type {import("@prisma/client").Prisma.ComponentCreateManyInput[]} */
  const rows = [];
  /** @type {import("@prisma/client").Prisma.ComponentCheckoutCreateManyInput[]} */
  const checkouts = [];

  ctx.catalog.components.forEach((entry, index) => {
    const minQuantity = int(entry.minimum[0], entry.minimum[1]);
    const remaining =
      index % 4 === 1
        ? int(0, Math.max(0, minQuantity - 1))
        : Math.max(int(entry.quantity[0], entry.quantity[1]), minQuantity + 1);
    const purchase = daysBefore(anchor, int(10, 500));
    const id = uuid();
    let outstanding = 0;

    const checkoutCount = hostAssets.length > 0 && chance(0.7) ? int(1, 3) : 0;
    for (let slot = 0; slot < checkoutCount; slot += 1) {
      const returned = chance(0.3);
      const quantity = int(1, 2);
      if (!returned) outstanding += quantity;
      const checkedOutAt = daysBefore(anchor, int(3, 150));
      checkouts.push({
        id: uuid(),
        componentId: id,
        assetId: pick(hostAssets).id,
        quantity,
        checkedOutBy: pick(people.managers).userid,
        checkedOutAt,
        returnedAt: returned
          ? clampDate(daysAfter(checkedOutAt, int(2, 40)), anchor)
          : null,
        notes: returned ? "Swapped back after test" : "Upgrade installed",
      });
    }

    rows.push({
      id,
      name: entry.name,
      serialNumber: null,
      categoryId: ref.categories.component.idByName[entry.category],
      totalQuantity: remaining + outstanding,
      remainingQuantity: remaining,
      purchasePrice: money(entry.price[0], entry.price[1]),
      purchaseDate: dateOnly(purchase),
      minQuantity,
      manufacturerId: ref.manufacturers.idByName[entry.manufacturer],
      supplierId: pick(ref.suppliers.ids),
      locationId: pick(ref.locations.leaves).id,
      organizationId: ctx.orgId,
      createdAt: clampDate(daysAfter(purchase, 1), anchor),
    });
  });

  return { rows, checkouts };
}

function licenceKey(used) {
  let key;
  do {
    key = Array.from({ length: 4 }, () =>
      faker.string.alphanumeric({ length: 5, casing: "upper" }),
    ).join("-");
  } while (used.has(key));
  used.add(key);
  return key;
}

/** Expiry mix: a few expired, a few expiring soon, most renewed later. */
function pickExpiryOffsetDays() {
  return weighted([
    { item: int(-45, -5), weight: 1 },
    { item: int(5, 28), weight: 1 },
    { item: int(30, 75), weight: 1 },
    { item: int(90, 360), weight: 4 },
  ]);
}

function buildLicences(ctx) {
  const { anchor, ref, people } = ctx;
  const userPool = [...people.managers, ...people.standard];
  const usedKeys = new Set();
  /** @type {import("@prisma/client").Prisma.licenceCreateManyInput[]} */
  const rows = [];
  /** @type {import("@prisma/client").Prisma.LicenceSeatAssignmentCreateManyInput[]} */
  const seats = [];
  const meta = [];

  for (const entry of ctx.catalog.licences) {
    const headcount = userPool.length + 1;
    const seatCount = Math.max(
      3,
      Math.round(
        headcount * (entry.seats[0] + (entry.seats[1] - entry.seats[0]) / 2),
      ),
    );
    const perpetual = entry.renewal === "perpetual";
    const expiration = perpetual
      ? null
      : daysAfter(anchor, pickExpiryOffsetDays());
    const purchase = perpetual
      ? daysBefore(anchor, int(200, 900))
      : addMonths(expiration, -12);
    const id = uuid();

    rows.push({
      licenceid: id,
      licencekey: licenceKey(usedKeys),
      licensedtoemail: people.admin.email,
      purchaseprice:
        Math.round(money(entry.price[0], entry.price[1]) * seatCount * 100) /
        100,
      purchasedate: dateOnly(purchase),
      expirationdate: expiration ? dateOnly(expiration) : null,
      notes: entry.product,
      requestable: true,
      licencecategorytypeid: ref.categories.licence.idByName[entry.category],
      manufacturerid: ref.manufacturers.idByName[entry.manufacturer],
      supplierid: pick(ref.suppliers.ids),
      seatCount,
      organizationId: ctx.orgId,
      creation_date: clampDate(daysAfter(purchase, 1), anchor),
    });

    const assignedCount = Math.min(
      userPool.length,
      seatCount,
      Math.max(
        1,
        Math.round(
          seatCount * (0.6 + faker.number.float({ min: 0, max: 0.4 })),
        ),
      ),
    );
    const assignedUsers = sample(userPool, assignedCount);
    assignedUsers.forEach((user, seatIndex) => {
      seats.push({
        id: uuid(),
        licenceId: id,
        userId: user.userid,
        seatNumber: seatIndex + 1,
        assignedAt: clampDate(daysAfter(purchase, int(1, 60)), anchor),
        assignedBy: people.admin.userid,
      });
    });
    meta.push({
      id,
      assignedUserIds: assignedUsers.map((user) => user.userid),
      name: entry.product,
    });
  }

  return { rows, seats, meta };
}

module.exports = {
  buildAssets,
  buildAccessories,
  buildConsumables,
  buildComponents,
  buildLicences,
};
