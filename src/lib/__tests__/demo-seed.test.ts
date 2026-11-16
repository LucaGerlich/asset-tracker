import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

// rbac.ts creates a Prisma client on import; the role-sync test only needs its constants.
vi.mock("@/lib/prisma", () => ({ default: {} }));

import { DEFAULT_ROLES, PERMISSIONS } from "@/lib/rbac";

type Row = Record<string, unknown>;

interface DemoOrgDefinition {
  key: string;
  name: string;
  slug: string;
  plan: string;
  domain: string;
  tagPrefix: string;
  counts: { assets: number; managers: number; users: number };
}

interface Dataset {
  key: string;
  orgId: string;
  data: Record<string, Row[]>;
}

interface DemoSeedModule {
  DEMO_ORGS: DemoOrgDefinition[];
  INSERT_PLAN: [string, string][];
  CLEANUP_STEPS: [string, (ids: string[]) => unknown][];
  resolveAnchor: (env: Record<string, string | undefined>) => Date;
  buildAllDatasets: (options: {
    anchor: Date;
    passwordHash: string;
  }) => Dataset[];
  cleanupDemoOrgs: (
    prisma: Record<string, unknown>,
    orgIds: string[],
  ) => Promise<{ model: string; count: number }[]>;
  assertDemoSeedConfirmed: (env: Record<string, string | undefined>) => void;
  describeDatabaseTarget: (url: string) => string;
}

interface CleanupModule {
  findDemoOrgIds: (prisma: Record<string, unknown>) => Promise<string[]>;
}

interface RolesModule {
  ALL_PERMISSIONS: string[];
  SYSTEM_ROLES: Record<string, { name: string; permissions: string[] }>;
}

const repoRoot = path.resolve(__dirname, "../../..");
const nodeRequire = createRequire(import.meta.url);
const demoSeed = nodeRequire(
  path.join(repoRoot, "prisma/demo-seed.js"),
) as DemoSeedModule;
const cleanupModule = nodeRequire(
  path.join(repoRoot, "prisma/demo-seed/cleanup.js"),
) as CleanupModule;
const rolesModule = nodeRequire(
  path.join(repoRoot, "prisma/demo-seed/roles.js"),
) as RolesModule;

const ANCHOR = new Date("2026-11-16T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function createMockPrisma() {
  const delegates: Record<string, { deleteMany: ReturnType<typeof vi.fn> }> =
    {};
  for (const [model] of demoSeed.CLEANUP_STEPS) {
    delegates[model] = { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) };
  }
  delegates.organization = {
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  return delegates;
}

/** Collects every `{ in: [...] }` value found anywhere inside a where clause. */
function collectInLists(where: unknown): string[][] {
  if (Array.isArray(where) || where === null || typeof where !== "object")
    return [];
  const found: string[][] = [];
  for (const [key, value] of Object.entries(where)) {
    if (key === "in" && Array.isArray(value)) found.push(value as string[]);
    else found.push(...collectInLists(value));
  }
  return found;
}

describe("demo seed safety guard", () => {
  it("refuses to run without DEMO_SEED_CONFIRM=yes", () => {
    expect(() => demoSeed.assertDemoSeedConfirmed({})).toThrow(
      /DEMO_SEED_CONFIRM=yes/,
    );
    expect(() =>
      demoSeed.assertDemoSeedConfirmed({ DEMO_SEED_CONFIRM: "true" }),
    ).toThrow();
    expect(() =>
      demoSeed.assertDemoSeedConfirmed({ DEMO_SEED_CONFIRM: "YES" }),
    ).toThrow();
  });

  it("accepts an explicit confirmation", () => {
    expect(() =>
      demoSeed.assertDemoSeedConfirmed({ DEMO_SEED_CONFIRM: "yes" }),
    ).not.toThrow();
  });

  it("describes the target without credentials", () => {
    const target = demoSeed.describeDatabaseTarget(
      "postgresql://admin:s3cret-pass@db.example.com:6543/assets?sslmode=require",
    );
    expect(target).toBe("db.example.com:6543/assets");
    expect(target).not.toContain("s3cret");
    expect(target).not.toContain("admin");
  });

  it("does not leak an unparseable connection string", () => {
    expect(
      demoSeed.describeDatabaseTarget("not a url with secret"),
    ).not.toContain("secret");
  });
});

describe("demo organization definitions", () => {
  it("defines three tenants with demo- slugs", () => {
    expect(demoSeed.DEMO_ORGS).toHaveLength(3);
    for (const org of demoSeed.DEMO_ORGS) {
      expect(org.slug.startsWith("demo-")).toBe(true);
    }
  });

  it("uses unique slugs, domains and tag prefixes", () => {
    for (const field of ["slug", "domain", "tagPrefix"] as const) {
      const values = demoSeed.DEMO_ORGS.map((org) => org[field]);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("covers the three plans", () => {
    expect(demoSeed.DEMO_ORGS.map((org) => org.plan).sort()).toEqual([
      "enterprise",
      "professional",
      "starter",
    ]);
  });
});

describe("cleanupDemoOrgs", () => {
  const orgIds = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
  ];

  it("only issues deleteMany calls filtered to the demo organization ids", async () => {
    const prisma = createMockPrisma();
    await demoSeed.cleanupDemoOrgs(prisma, orgIds);

    for (const [model, delegate] of Object.entries(prisma)) {
      expect(delegate.deleteMany, model).toHaveBeenCalledTimes(1);
      const [args] = delegate.deleteMany.mock.calls[0] as [{ where?: unknown }];
      expect(args.where, model).toBeDefined();
      expect(Object.keys(args.where as object).length, model).toBeGreaterThan(
        0,
      );
      const lists = collectInLists(args.where);
      expect(lists.length, model).toBeGreaterThan(0);
      for (const list of lists) expect(list, model).toEqual(orgIds);
    }
  });

  it("deletes children first and the organizations last", async () => {
    const prisma = createMockPrisma();
    const results = await demoSeed.cleanupDemoOrgs(prisma, orgIds);
    const order = results.map((result) => result.model);
    expect(order[order.length - 1]).toBe("organization");
    expect(order.indexOf("userAssets")).toBeLessThan(order.indexOf("asset"));
    expect(order.indexOf("licenceSeatAssignment")).toBeLessThan(
      order.indexOf("licence"),
    );
    expect(order.indexOf("asset")).toBeLessThan(order.indexOf("location"));
    expect(order.indexOf("itemRequest")).toBeLessThan(order.indexOf("user"));
    expect(order.indexOf("audit_logs")).toBeLessThan(order.indexOf("user"));
    expect(order.indexOf("user")).toBeLessThan(order.indexOf("organization"));
  });

  it("does nothing without organization ids", async () => {
    const prisma = createMockPrisma();
    expect(await demoSeed.cleanupDemoOrgs(prisma, [])).toEqual([]);
    for (const delegate of Object.values(prisma)) {
      expect(delegate.deleteMany).not.toHaveBeenCalled();
    }
  });

  it("never calls any other write method", async () => {
    const prisma = {
      ...createMockPrisma(),
      $executeRaw: vi.fn(),
      $queryRaw: vi.fn(),
    };
    await demoSeed.cleanupDemoOrgs(prisma, orgIds);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("finds demo organizations by slug prefix only", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "a" }, { id: "b" }]);
    const ids = await cleanupModule.findDemoOrgIds({
      organization: { findMany },
    });
    expect(ids).toEqual(["a", "b"]);
    expect(findMany).toHaveBeenCalledWith({
      where: { slug: { startsWith: "demo-" } },
      select: { id: true },
    });
  });

  it("covers every model that carries an organizationId column", () => {
    const schema = fs.readFileSync(
      path.join(repoRoot, "prisma/schema.prisma"),
      "utf8",
    );
    const covered = new Set(demoSeed.CLEANUP_STEPS.map(([model]) => model));
    const missing: string[] = [];
    for (const match of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
      const [, name, body] = match;
      if (name === "Organization" || !/^\s+organizationId\s/m.test(body))
        continue;
      const delegate = name.charAt(0).toLowerCase() + name.slice(1);
      if (!covered.has(delegate)) missing.push(name);
    }
    expect(missing).toEqual([]);
  });
});

describe("demo seed datasets", () => {
  let datasets: Dataset[];

  beforeAll(() => {
    datasets = demoSeed.buildAllDatasets({
      anchor: ANCHOR,
      passwordHash: "bcrypt-hash",
    });
  });

  it("is deterministic for a fixed anchor", () => {
    const again = demoSeed.buildAllDatasets({
      anchor: ANCHOR,
      passwordHash: "bcrypt-hash",
    });
    expect(JSON.stringify(again)).toBe(JSON.stringify(datasets));
  });

  it("has a build step for every insert in the plan", () => {
    for (const set of datasets) {
      for (const [, key] of demoSeed.INSERT_PLAN) {
        expect(Array.isArray(set.data[key]), key).toBe(true);
      }
      expect(Object.keys(set.data).sort()).toEqual(
        demoSeed.INSERT_PLAN.map(([, key]) => key).sort(),
      );
    }
  });

  it("creates the configured number of assets and users per tenant", () => {
    for (const def of demoSeed.DEMO_ORGS) {
      const set = datasets.find((entry) => entry.key === def.key) as Dataset;
      expect(set.data.assets).toHaveLength(def.counts.assets);
      expect(set.data.users).toHaveLength(
        1 + def.counts.managers + def.counts.users,
      );
    }
  });

  it("scopes every row with an organizationId to its own organization", () => {
    for (const set of datasets) {
      for (const [key, rows] of Object.entries(set.data)) {
        for (const row of rows) {
          if ("organizationId" in row) {
            expect(row.organizationId, `${set.key}.${key}`).toBe(set.orgId);
          }
        }
      }
    }
  });

  it("creates organizations on their plans with demo slugs", () => {
    for (const set of datasets) {
      const [org] = set.data.organizations;
      expect(String(org.slug).startsWith("demo-")).toBe(true);
      expect(org.isActive).toBe(true);
      expect(org.suspendedAt).toBeUndefined();
    }
  });

  it("gives every user a credential account with the shared hash", () => {
    for (const set of datasets) {
      const accountByUser = new Map(
        set.data.accounts.map((account) => [account.userId, account]),
      );
      for (const user of set.data.users) {
        const account = accountByUser.get(user.userid);
        expect(account?.providerId).toBe("credential");
        expect(account?.accountId).toBe(user.userid);
        expect(account?.password).toBe("bcrypt-hash");
        expect(user.isActive).toBe(true);
        expect(user.emailVerified).toBe(true);
        expect(user.organizationId).toBe(set.orgId);
      }
      const admins = set.data.users.filter((user) => user.isadmin === true);
      expect(admins).toHaveLength(1);
      expect(String(admins[0].email)).toMatch(/^admin@.+\.demo$/);
    }
  });

  it("assigns an org-scoped role to every user", () => {
    for (const set of datasets) {
      const roleIds = new Set(set.data.roles.map((role) => role.id));
      const userIds = new Set(set.data.users.map((user) => user.userid));
      expect(set.data.userRoles).toHaveLength(set.data.users.length);
      for (const link of set.data.userRoles) {
        expect(roleIds.has(link.roleId)).toBe(true);
        expect(userIds.has(link.userId)).toBe(true);
      }
    }
  });

  it("keeps globally unique values unique across tenants", () => {
    const collect = (key: string, field: string) =>
      datasets.flatMap((set) => set.data[key].map((row) => String(row[field])));
    for (const [key, field] of [
      ["users", "email"],
      ["users", "username"],
      ["assets", "assettag"],
      ["assets", "serialnumber"],
    ] as const) {
      const values = collect(key, field);
      expect(new Set(values).size, `${key}.${field}`).toBe(values.length);
    }
  });

  it("respects the licence seat constraints", () => {
    for (const set of datasets) {
      const seatKeys = new Set<string>();
      const userKeys = new Set<string>();
      for (const seat of set.data.licenceSeats) {
        const seatKey = `${seat.licenceId}:${seat.seatNumber}`;
        const userKey = `${seat.licenceId}:${seat.userId}`;
        expect(seatKeys.has(seatKey)).toBe(false);
        expect(userKeys.has(userKey)).toBe(false);
        seatKeys.add(seatKey);
        userKeys.add(userKey);
      }
      const keys = set.data.licences.map((licence) => licence.licencekey);
      expect(new Set(keys).size).toBe(keys.length);
      for (const licence of set.data.licences) {
        const used = set.data.licenceSeats.filter(
          (seat) => seat.licenceId === licence.licenceid,
        );
        expect(used.length).toBeLessThanOrEqual(Number(licence.seatCount));
      }
    }
  });

  it("keeps assignments, requests and receipts referentially consistent", () => {
    for (const set of datasets) {
      const assetIds = new Set(set.data.assets.map((asset) => asset.assetid));
      const userIds = new Set(set.data.users.map((user) => user.userid));
      for (const link of set.data.userAssets) {
        expect(assetIds.has(link.assetid)).toBe(true);
        expect(userIds.has(link.userid)).toBe(true);
      }
      for (const reservation of set.data.reservations) {
        expect(assetIds.has(reservation.assetId)).toBe(true);
        expect(userIds.has(reservation.userId)).toBe(true);
      }
      const open = set.data.itemRequests.filter(
        (request) =>
          request.status === "pending" || request.status === "approved",
      );
      const openEntities = open.map((request) => request.entityId);
      expect(new Set(openEntities).size).toBe(openEntities.length);
      const poNumbers = set.data.purchaseOrders.map((order) => order.poNumber);
      expect(new Set(poNumbers).size).toBe(poNumbers.length);
    }
  });

  it("only gives plan-gated data to plans that include the feature", () => {
    const starter = datasets.find((set) => set.key === "brightside") as Dataset;
    expect(starter.data.purchaseRequests).toHaveLength(0);
    expect(starter.data.customFieldDefinitions).toHaveLength(0);
    for (const key of ["northwind", "helios"]) {
      const set = datasets.find((entry) => entry.key === key) as Dataset;
      expect(set.data.purchaseRequests.length).toBeGreaterThan(0);
      expect(set.data.purchaseOrders.length).toBeGreaterThan(0);
      expect(set.data.customFieldDefinitions.length).toBeGreaterThan(0);
    }
  });

  it("includes low-stock consumables and assets in several states", () => {
    for (const set of datasets) {
      const low = set.data.consumables.filter(
        (item) => Number(item.quantity) < Number(item.minQuantity),
      );
      expect(low.length).toBeGreaterThan(0);
      const statusIds = new Set(
        set.data.assets.map((asset) => asset.statustypeid),
      );
      expect(statusIds.size).toBeGreaterThanOrEqual(3);
    }
  });

  it("spreads audit logs over the last six months without future dates", () => {
    for (const set of datasets) {
      const userIds = new Set(set.data.users.map((user) => user.userid));
      const times = set.data.auditLogs.map((log) =>
        (log.createdAt as Date).getTime(),
      );
      expect(Math.max(...times)).toBeLessThanOrEqual(ANCHOR.getTime());
      expect(Math.min(...times)).toBeGreaterThan(
        ANCHOR.getTime() - 184 * DAY_MS,
      );
      expect(Math.max(...times) - Math.min(...times)).toBeGreaterThan(
        120 * DAY_MS,
      );
      for (const log of set.data.auditLogs)
        expect(userIds.has(log.userId)).toBe(true);
    }
  });
});

describe("demo roles", () => {
  it("mirror the application's permissions and default roles", () => {
    expect([...rolesModule.ALL_PERMISSIONS].sort()).toEqual(
      Object.keys(PERMISSIONS).sort(),
    );
    for (const key of ["admin", "manager", "user"] as const) {
      expect(rolesModule.SYSTEM_ROLES[key].name).toBe(DEFAULT_ROLES[key].name);
      expect([...rolesModule.SYSTEM_ROLES[key].permissions].sort()).toEqual(
        [...DEFAULT_ROLES[key].permissions].sort(),
      );
    }
  });
});
