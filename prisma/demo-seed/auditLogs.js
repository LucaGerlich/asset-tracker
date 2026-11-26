// Six months of audit-log history so dashboards and activity charts have data.

const { faker } = require("@faker-js/faker");
const { uuid, int, chance, pick, weighted, daysBefore } = require("./util");

const HISTORY_DAYS = 183;

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
];

/** Recent days are busier than old ones; weekends are mostly quiet. */
function pickTimestamp(anchor) {
  for (;;) {
    const daysAgo = Math.floor(
      HISTORY_DAYS * Math.pow(faker.number.float({ min: 0, max: 1 }), 1.4),
    );
    const day = daysBefore(anchor, daysAgo);
    const weekday = day.getUTCDay();
    if ((weekday === 0 || weekday === 6) && !chance(0.12)) continue;
    const startOfDay = new Date(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()),
    );
    const timestamp = new Date(
      startOfDay.getTime() +
        int(7 * 60, 18 * 60) * 60 * 1000 +
        int(0, 59) * 1000,
    );
    if (timestamp.getTime() <= anchor.getTime()) return timestamp;
    return new Date(anchor.getTime() - int(1, 600) * 1000);
  }
}

/**
 * Event templates: what happened to which kind of record. `source` names the
 * collection in `pools`; `details` builds the JSON payload.
 */
const EVENTS = [
  {
    weight: 22,
    action: "LOGIN",
    entity: "user",
    source: "users",
    details: () => ({ method: "password" }),
  },
  {
    weight: 18,
    action: "UPDATE",
    entity: "asset",
    source: "assets",
    details: (item) => ({
      name: item.name,
      changed: pick(["location", "notes", "status", "specs"]),
    }),
  },
  {
    weight: 10,
    action: "ASSIGN",
    entity: "asset",
    source: "assets",
    details: (item) => ({ name: item.name }),
  },
  {
    weight: 8,
    action: "UNASSIGN",
    entity: "asset",
    source: "assets",
    details: (item) => ({ name: item.name }),
  },
  {
    weight: 7,
    action: "CREATE",
    entity: "asset",
    source: "assets",
    details: (item) => ({ name: item.name }),
  },
  {
    weight: 6,
    action: "UPDATE",
    entity: "accessory",
    source: "accessories",
    details: (item) => ({ name: item.name }),
  },
  {
    weight: 5,
    action: "CREATE",
    entity: "accessory",
    source: "accessories",
    details: (item) => ({ name: item.name }),
  },
  {
    weight: 6,
    action: "ASSIGN",
    entity: "license",
    source: "licences",
    details: (item) => ({ name: item.name }),
  },
  {
    weight: 5,
    action: "UPDATE",
    entity: "consumable",
    source: "consumables",
    details: (item) => ({ name: item.name, quantity: int(0, 60) }),
  },
  {
    weight: 4,
    action: "REQUEST",
    entity: "asset",
    source: "assets",
    details: (item) => ({ name: item.name }),
  },
  {
    weight: 3,
    action: "APPROVE",
    entity: "asset",
    source: "assets",
    details: (item) => ({ name: item.name }),
  },
  {
    weight: 2,
    action: "REJECT",
    entity: "asset",
    source: "assets",
    details: (item) => ({ name: item.name }),
  },
  {
    weight: 2,
    action: "UPDATE",
    entity: "user",
    source: "users",
    details: () => ({ changed: "department" }),
  },
];

function buildAuditLogs(ctx, pools) {
  const { def, anchor, people } = ctx;
  const actors = [
    { item: people.admin, weight: 15 },
    ...people.managers.map((user) => ({
      item: user,
      weight: 30 / people.managers.length,
    })),
    ...people.standard.map((user) => ({
      item: user,
      weight: 55 / people.standard.length,
    })),
  ];
  const events = EVENTS.map((event) => ({ item: event, weight: event.weight }));
  const sources = {
    ...pools,
    users: people.all.map((user) => ({ id: user.userid, name: user.email })),
  };

  /** @type {import("@prisma/client").Prisma.audit_logsCreateManyInput[]} */
  const rows = [];
  for (let index = 0; index < def.counts.auditLogs; index += 1) {
    const event = weighted(events);
    const actor = weighted(actors);
    const target = pick(sources[event.source]);
    const createdAt = pickTimestamp(anchor);
    rows.push({
      id: uuid(),
      userId: actor.userid,
      action: event.action,
      entity: event.entity,
      entityId:
        event.entity === "user" && event.action === "LOGIN"
          ? actor.userid
          : target.id,
      details: JSON.stringify(event.details(target)),
      ipAddress: faker.internet.ipv4(),
      userAgent: pick(USER_AGENTS),
      createdAt,
    });
  }
  rows.sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
  return rows;
}

module.exports = { buildAuditLogs, HISTORY_DAYS };
