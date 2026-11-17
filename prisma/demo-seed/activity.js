// Workflow data of a tenant: maintenance, reservations, item requests,
// procurement, audit campaign and custom fields.

const { PLAN_FEATURES } = require("./config");
const {
  uuid,
  int,
  chance,
  pick,
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

const FREQUENCY_MONTHS = { monthly: 1, quarterly: 3, annually: 12 };

const isRetired = (asset) =>
  asset.status === "Retired" || asset.status === "Disposed";

/** Recurring maintenance for assets whose catalog entry asks for it, with completed runs in the log. */
function buildMaintenance(ctx, assetMeta) {
  const { anchor, people } = ctx;
  const candidates = assetMeta
    .filter((asset) => asset.entry.maintenance && !isRetired(asset))
    .slice(0, 60);
  /** @type {import("@prisma/client").Prisma.maintenance_schedulesCreateManyInput[]} */
  const schedules = [];
  /** @type {import("@prisma/client").Prisma.maintenance_logsCreateManyInput[]} */
  const logs = [];

  for (const asset of candidates) {
    const { title, frequency, cost } = asset.entry.maintenance;
    const stepMonths = FREQUENCY_MONTHS[frequency];
    const overdue = chance(0.15);
    const nextDue = overdue
      ? daysBefore(anchor, int(1, 30))
      : daysAfter(anchor, int(1, stepMonths * 30));
    const id = uuid();
    const runs = int(1, 3);
    const lastRuns = [];
    for (let run = 1; run <= runs; run += 1) {
      const completedAt = addMonths(nextDue, -stepMonths * run);
      if (completedAt > asset.purchase && completedAt < anchor) {
        lastRuns.push(completedAt);
      }
    }
    const assignee = pick(people.managers);
    const createdAt = clampDate(
      daysAfter(asset.purchase, 2),
      daysBefore(anchor, 1),
    );

    schedules.push({
      id,
      assetId: asset.id,
      title,
      description: `Recurring ${frequency} task for ${asset.name}.`,
      frequency,
      nextDueDate: dateOnly(nextDue),
      lastCompletedAt: lastRuns[0] ?? null,
      assignedTo: assignee.userid,
      estimatedCost: cost,
      isActive: true,
      createdAt,
      updatedAt: createdAt,
    });
    for (const completedAt of lastRuns) {
      logs.push({
        id: uuid(),
        scheduleId: id,
        completedBy: assignee.userid,
        completedAt,
        notes: "Completed without findings.",
        actualCost: cost === 0 ? 0 : money(cost * 0.8, cost * 1.3),
        createdAt: completedAt,
      });
    }
  }
  return { schedules, logs };
}

const RESERVATION_STATUSES = [
  "pending",
  "approved",
  "approved",
  "rejected",
  "cancelled",
  "pending",
  "approved",
  "approved",
];

/** Short bookings of free, requestable equipment: past, running and upcoming. */
function buildReservations(ctx, assetMeta) {
  const { anchor, people } = ctx;
  const free = shuffle(assetMeta.filter((asset) => asset.requestable));
  /** @type {import("@prisma/client").Prisma.AssetReservationCreateManyInput[]} */
  const rows = [];

  free.slice(0, ctx.def.counts.reservations).forEach((asset, index) => {
    const status = RESERVATION_STATUSES[index % RESERVATION_STATUSES.length];
    const startOffset = status === "pending" ? int(2, 20) : int(-40, 25);
    const start = daysAfter(anchor, startOffset);
    const end = daysAfter(start, int(1, 5));
    const requester = pick(people.standard);
    const decided = status === "approved" || status === "rejected";
    const createdAt = clampDate(daysBefore(start, int(2, 12)), anchor);
    rows.push({
      id: uuid(),
      assetId: asset.id,
      userId: requester.userid,
      startDate: start,
      endDate: end,
      status,
      notes: pick([
        "Needed for an on-site workshop.",
        "Customer demo next week.",
        "Replacement while my device is in repair.",
        "Training day for new hires.",
      ]),
      approvedBy: decided ? pick(people.managers).userid : null,
      approvedAt: decided ? clampDate(daysAfter(createdAt, 1), anchor) : null,
      createdAt,
      updatedAt: createdAt,
    });
  });
  return rows;
}

/**
 * Item requests in different states. The partial unique index
 * item_requests_active_unique allows one open request (pending/approved) per
 * entity, so open requests never share an entity. Approved requests point at
 * equipment the requester really holds.
 */
function buildItemRequests(ctx, inventory) {
  const { anchor, people } = ctx;
  const { assets, accessories, consumables, licences } = inventory;
  const openEntities = new Set();
  /** @type {import("@prisma/client").Prisma.ItemRequestCreateManyInput[]} */
  const rows = [];

  const addRequest = (entityType, entityId, userId, status) => {
    const open = status === "pending" || status === "approved";
    if (open) {
      if (openEntities.has(entityId)) return;
      openEntities.add(entityId);
    }
    const createdAt = daysBefore(anchor, int(1, 60));
    const decided = status !== "pending" && status !== "cancelled";
    const approvedAt = decided
      ? clampDate(daysAfter(createdAt, 1), anchor)
      : null;
    rows.push({
      id: uuid(),
      entityType,
      entityId,
      userId,
      status,
      quantity: 1,
      notes: pick([
        "Needed for my current project.",
        "Old one is failing.",
        "Required for new team member.",
      ]),
      approvedBy: decided ? pick(people.managers).userid : null,
      approvedAt,
      returnedAt:
        status === "returned"
          ? clampDate(daysAfter(approvedAt, int(3, 30)), anchor)
          : null,
      createdAt,
      updatedAt: approvedAt ?? createdAt,
    });
  };

  const freeAssets = shuffle(assets.filter((asset) => asset.requestable));
  const heldAssets = shuffle(assets.filter((asset) => asset.assigneeId));
  const freeAccessories = shuffle(
    accessories.filter((acc) => acc.status === "Available"),
  );
  const stocked = shuffle(consumables.filter((item) => item.quantity > 0));
  const target = ctx.def.counts.requests;

  const plan = [
    ["pending", "asset"],
    ["pending", "accessory"],
    ["pending", "consumable"],
    ["pending", "licence"],
    ["approved", "asset"],
    ["approved", "asset"],
    ["rejected", "asset"],
    ["returned", "asset"],
    ["cancelled", "accessory"],
    ["pending", "asset"],
    ["approved", "licence"],
    ["returned", "accessory"],
  ];

  plan.slice(0, target).forEach(([status, type], index) => {
    const requester = pick(people.standard);
    if (type === "asset" && status === "approved") {
      const held = heldAssets[index % Math.max(1, heldAssets.length)];
      if (held) addRequest("asset", held.id, held.assigneeId, status);
    } else if (type === "asset") {
      const free = freeAssets[index % Math.max(1, freeAssets.length)];
      if (free) addRequest("asset", free.id, requester.userid, status);
    } else if (type === "accessory") {
      const item = freeAccessories[index % Math.max(1, freeAccessories.length)];
      if (item) addRequest("accessory", item.id, requester.userid, status);
    } else if (type === "consumable") {
      const item = stocked[index % Math.max(1, stocked.length)];
      if (item) addRequest("consumable", item.id, requester.userid, status);
    } else if (type === "licence" && status === "approved") {
      const licence = licences.find(
        (entry) => entry.assignedUserIds.length > 0,
      );
      if (licence)
        addRequest("licence", licence.id, licence.assignedUserIds[0], status);
    } else if (type === "licence") {
      const licence = licences[index % licences.length];
      addRequest("licence", licence.id, requester.userid, status);
    }
  });
  return rows;
}

const nextPoNumber = (anchor, sequence) =>
  `PO-${anchor.getUTCFullYear()}${padNumber(anchor.getUTCMonth() + 1, 2)}-${padNumber(sequence, 4)}`;

/**
 * Procurement is a Professional/Enterprise feature. Request 1 is a draft,
 * request 2 awaits approval, request 3 was approved and ordered (PO sent);
 * enterprise additionally has a fully received order with a goods receipt.
 */
function buildProcurement(ctx) {
  const { def, anchor, people, ref } = ctx;
  /** @type {{ requests: import("@prisma/client").Prisma.PurchaseRequestCreateManyInput[], items: import("@prisma/client").Prisma.PurchaseRequestItemCreateManyInput[], orders: import("@prisma/client").Prisma.PurchaseOrderCreateManyInput[], receipts: import("@prisma/client").Prisma.GoodsReceiptCreateManyInput[] }} */
  const result = { requests: [], items: [], orders: [], receipts: [] };
  if (!PLAN_FEATURES[def.plan].procurement) return result;

  const requestSpecs = [
    {
      title: "Laptops for new hires",
      status: "draft",
      priority: "medium",
      lines: [{ description: "Latitude 5450 laptop", quantity: 4, cost: 1290 }],
    },
    {
      title: "Replacement monitors",
      status: "pending_approval",
      priority: "high",
      lines: [
        { description: "UltraSharp U2724D monitor", quantity: 6, cost: 450 },
      ],
    },
    {
      title: "Dock and peripheral refresh",
      status: "ordered",
      priority: "medium",
      lines: [
        { description: "WD22TB4 docking station", quantity: 8, cost: 290 },
        { description: "MX Keys S keyboard", quantity: 8, cost: 105 },
      ],
    },
  ];
  if (def.plan === "enterprise") {
    requestSpecs.push({
      title: "Lab oscilloscope",
      status: "ordered",
      priority: "high",
      received: true,
      lines: [
        {
          description: "InfiniiVision MSOX3054T oscilloscope",
          quantity: 2,
          cost: 7200,
        },
      ],
    });
  }

  let sequence = 0;

  requestSpecs.forEach((spec, index) => {
    const requestId = uuid();
    const createdAt = daysBefore(anchor, 45 - index * 10);
    const approved = spec.status === "ordered";
    const total = spec.lines.reduce(
      (sum, line) => sum + line.quantity * line.cost,
      0,
    );
    const lineIds = spec.lines.map(() => uuid());
    const supplierId = pick(ref.suppliers.ids);

    result.requests.push({
      id: requestId,
      title: spec.title,
      description: `${spec.title} (demo request)`,
      requesterId: pick(people.managers).userid,
      organizationId: ctx.orgId,
      status: spec.status,
      priority: spec.priority,
      estimatedTotal: total,
      approvedBy: approved ? people.admin.userid : null,
      approvedAt: approved ? daysAfter(createdAt, 2) : null,
      createdAt,
    });
    spec.lines.forEach(({ description, quantity, cost }, lineIndex) => {
      result.items.push({
        id: lineIds[lineIndex],
        purchaseRequestId: requestId,
        entityType: "asset",
        description,
        quantity,
        estimatedUnitCost: cost,
        supplierId,
        receivedQuantity: spec.received ? quantity : 0,
      });
    });

    if (!approved) return;
    sequence += 1;
    const orderId = uuid();
    const sentAt = daysAfter(createdAt, 3);
    result.orders.push({
      id: orderId,
      purchaseRequestId: requestId,
      poNumber: nextPoNumber(anchor, sequence),
      supplierId,
      organizationId: ctx.orgId,
      status: spec.received ? "received" : "sent",
      totalAmount: total,
      sentAt,
      expectedDeliveryDate: dateOnly(daysAfter(sentAt, 14)),
      createdAt: sentAt,
    });
    if (spec.received) {
      result.receipts.push({
        id: uuid(),
        purchaseOrderId: orderId,
        receivedBy: people.admin.userid,
        receivedAt: daysAfter(sentAt, 12),
        items: spec.lines.map(({ quantity }, lineIndex) => ({
          itemId: lineIds[lineIndex],
          receivedQty: quantity,
          condition: "good",
        })),
      });
    }
  });
  return result;
}

/** Quarter label of the anchor, e.g. "Q4 2026". */
const quarterLabel = (date) =>
  `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;

/** One active campaign over all in-service assets, partly scanned. */
function buildAuditCampaign(ctx, assetMeta) {
  const { anchor, people, ref } = ctx;
  const campaignId = uuid();
  const auditors = [...people.managers.slice(0, 2), people.admin];
  /** @type {import("@prisma/client").Prisma.AuditCampaignCreateManyInput} */
  const campaign = {
    id: campaignId,
    name: `${quarterLabel(anchor)} Annual Asset Audit`,
    description: "Physical verification of all in-service assets.",
    status: "active",
    startDate: daysBefore(anchor, 21),
    dueDate: daysAfter(anchor, 14),
    organizationId: ctx.orgId,
    createdBy: people.admin.userid,
    scopeType: "all",
    createdAt: daysBefore(anchor, 22),
  };

  /** @type {import("@prisma/client").Prisma.AuditEntryCreateManyInput[]} */
  const entries = [];
  for (const asset of assetMeta.filter((entry) => !isRetired(entry))) {
    const outcome = weighted([
      { item: "found", weight: 54 },
      { item: "missing", weight: 4 },
      { item: "moved", weight: 6 },
      { item: "unscanned", weight: 36 },
    ]);
    const scanned = outcome !== "unscanned";
    const moved = outcome === "moved";
    entries.push({
      id: uuid(),
      campaignId,
      assetId: asset.id,
      status: outcome,
      auditedBy: scanned ? pick(auditors).userid : null,
      auditedAt: scanned ? daysBefore(anchor, int(0, 20)) : null,
      locationId: scanned
        ? moved
          ? pick(ref.locations.leaves).id
          : asset.locationId
        : null,
      notes: moved ? "Found in a different room, location updated." : null,
    });
  }

  /** @type {import("@prisma/client").Prisma.AuditCampaignAuditorCreateManyInput[]} */
  const auditorRows = auditors.map((user) => ({
    id: uuid(),
    campaignId,
    userId: user.userid,
  }));
  return { campaign, entries, auditors: auditorRows };
}

function customFieldValue(definition) {
  switch (definition.fieldType) {
    case "select":
      return pick(JSON.parse(definition.options));
    case "checkbox":
      return chance(0.7) ? "true" : "false";
    default:
      return `PRJ-${padNumber(int(1, 240), 3)}`;
  }
}

/** Custom field definitions on assets plus values for about 60 percent of them. */
function buildCustomFields(ctx, assetMeta) {
  const empty = { definitions: [], values: [] };
  if (!PLAN_FEATURES[ctx.def.plan].customFields) return empty;
  const { anchor } = ctx;

  /** @type {import("@prisma/client").Prisma.custom_field_definitionsCreateManyInput[]} */
  const definitions = ctx.catalog.customFields.map((field, index) => ({
    id: uuid(),
    name: field.name,
    fieldType: field.fieldType,
    options: field.options ? JSON.stringify(field.options) : null,
    isRequired: false,
    entityType: "asset",
    displayOrder: index,
    isActive: true,
    createdAt: daysBefore(anchor, 200),
    updatedAt: daysBefore(anchor, 200),
    organizationId: ctx.orgId,
  }));

  /** @type {import("@prisma/client").Prisma.custom_field_valuesCreateManyInput[]} */
  const values = [];
  for (const asset of assetMeta) {
    if (!chance(0.6)) continue;
    for (const definition of definitions) {
      const value =
        definition.fieldType === "date"
          ? dateOnly(daysBefore(anchor, int(5, 300)))
              .toISOString()
              .slice(0, 10)
          : customFieldValue(definition);
      values.push({
        id: uuid(),
        fieldId: definition.id,
        entityId: asset.id,
        value,
        createdAt: daysBefore(anchor, int(1, 150)),
        updatedAt: daysBefore(anchor, int(0, 1)),
      });
    }
  }
  return { definitions, values };
}

module.exports = {
  buildMaintenance,
  buildReservations,
  buildItemRequests,
  buildProcurement,
  buildAuditCampaign,
  buildCustomFields,
  isRetired,
};
