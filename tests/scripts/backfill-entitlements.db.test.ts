import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import pg from "pg";
import {
  applyBackfill,
  countUnset,
  planBackfill,
  summarizeBackfill,
} from "../../scripts/lib/backfill-entitlements";

// Same opt-in as src/lib/__tests__/scope-automation-migration.test.ts: never
// trust the host of DATABASE_URL; CI sets ALLOW_DESTRUCTIVE_DB_TESTS=1 for its
// throwaway Postgres. Everything runs in a transaction that is rolled back.
const databaseUrl = process.env.DATABASE_URL;
const describeDb =
  databaseUrl && process.env.ALLOW_DESTRUCTIVE_DB_TESTS === "1"
    ? describe
    : describe.skip;
const DB_TEST = { timeout: 30_000 };
const SCHEMA = process.env.DB_SCHEMA || "assettool";
const t = (name: string): string => `"${SCHEMA}"."${name}"`;
// Fails the strict entitlements schema: unknown feature, missing limits.
const INVALID_STORED = { features: ["white_label"] };

async function inRolledBackTransaction(
  fn: (client: pg.Client) => Promise<void>,
): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN");
    await fn(client);
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
}

async function insertOrg(
  client: pg.Client,
  fields: {
    plan: string;
    maxAssets: number;
    maxUsers: number;
    entitlements?: string | null;
  },
): Promise<string> {
  const id = randomUUID();
  await client.query(
    `INSERT INTO ${t("organizations")}
       ("id", "name", "slug", "plan", "maxAssets", "maxUsers", "entitlements", "updatedAt")
     VALUES ($1::uuid, $2, $2, $3, $4, $5, $6::jsonb, now())`,
    [
      id,
      `org-${id}`,
      fields.plan,
      fields.maxAssets,
      fields.maxUsers,
      fields.entitlements ?? null,
    ],
  );
  return id;
}

async function insertUsers(
  client: pg.Client,
  organizationId: string,
  activeFlags: readonly boolean[],
): Promise<void> {
  for (const isActive of activeFlags) {
    await client.query(
      `INSERT INTO ${t("user")}
         ("userid", "firstname", "lastname", "creation_date", "canrequest", "isadmin", "isActive", "organizationId")
       VALUES ($1::uuid, 'T', 'U', now(), false, false, $2, $3::uuid)`,
      [randomUUID(), isActive, organizationId],
    );
  }
}

async function insertAsset(
  client: pg.Client,
  organizationId: string,
): Promise<void> {
  const unique = randomUUID();
  await client.query(
    `INSERT INTO ${t("asset")}
       ("assetid", "assetname", "assettag", "serialnumber", "creation_date", "organizationId")
     VALUES ($1::uuid, $2, $3, $4, now(), $5::uuid)`,
    [
      unique,
      `asset-${unique}`,
      `tag-${unique}`,
      `sn-${unique}`,
      organizationId,
    ],
  );
}

async function storedEntitlements(
  client: pg.Client,
  id: string,
): Promise<unknown> {
  const result = await client.query(
    `SELECT "entitlements" FROM ${t("organizations")} WHERE "id" = $1::uuid`,
    [id],
  );
  return result.rows[0].entitlements;
}

describeDb("backfill-entitlements against Postgres", () => {
  it(
    "fills unset rows from the legacy plan and leaves set rows alone",
    DB_TEST,
    async () => {
      await inRolledBackTransaction(async (client) => {
        const starter = await insertOrg(client, {
          plan: "starter",
          maxAssets: 100,
          maxUsers: 3,
        });
        const enterprise = await insertOrg(client, {
          plan: "enterprise",
          maxAssets: 999999,
          maxUsers: -1,
        });
        const unknown = await insertOrg(client, {
          plan: "gold",
          maxAssets: 100,
          maxUsers: 3,
        });
        const jsonNull = await insertOrg(client, {
          plan: "starter",
          maxAssets: 100,
          maxUsers: 3,
          entitlements: "null",
        });
        const alreadySet = await insertOrg(client, {
          plan: "starter",
          maxAssets: 100,
          maxUsers: 3,
          entitlements: JSON.stringify({
            features: ["scim"],
            maxAssets: 7,
            maxUsers: 7,
          }),
        });
        const invalidStored = await insertOrg(client, {
          plan: "starter",
          maxAssets: 100,
          maxUsers: 3,
          entitlements: JSON.stringify(INVALID_STORED),
        });

        const rows = await planBackfill(client, SCHEMA, {
          deploymentSelfHosted: false,
        });
        const byId = new Map(rows.map((row) => [row.id, row]));

        expect(byId.get(starter)?.entitlementsSet).toBe(false);
        expect(byId.get(jsonNull)?.entitlementsSet).toBe(false);
        expect(byId.get(alreadySet)?.entitlementsSet).toBe(true);
        expect(byId.get(alreadySet)?.storedValid).toBe(true);
        expect(byId.get(starter)?.storedValid).toBeNull();
        expect(byId.get(jsonNull)?.storedValid).toBeNull();
        expect(byId.get(invalidStored)?.entitlementsSet).toBe(true);
        expect(byId.get(invalidStored)?.storedValid).toBe(false);
        expect(byId.get(unknown)?.knownPlan).toBe(false);
        expect(byId.get(starter)?.losesFeatures).toEqual([
          "scim",
          "advanced_reports",
          "tco_dashboard",
          "custom_fields",
          "workflow_automation",
        ]);

        const ours = rows.filter((row) =>
          [
            starter,
            enterprise,
            unknown,
            jsonNull,
            alreadySet,
            invalidStored,
          ].includes(row.id),
        );
        expect(summarizeBackfill(ours)).toMatchObject({
          organizations: 6,
          unset: 4,
          invalid: 1,
        });
        // Other organizations may exist in the database: compare to a baseline.
        const unsetBefore = await countUnset(client, SCHEMA);
        expect(await applyBackfill(client, SCHEMA, ours)).toBe(4);

        expect(await storedEntitlements(client, enterprise)).toMatchObject({
          maxAssets: null,
          maxUsers: null,
        });
        expect(await storedEntitlements(client, jsonNull)).toEqual({
          features: [],
          maxAssets: 100,
          maxUsers: 3,
        });
        expect(await storedEntitlements(client, alreadySet)).toEqual({
          features: ["scim"],
          maxAssets: 7,
          maxUsers: 7,
        });
        // An invalid stored value is reported, never overwritten.
        expect(await storedEntitlements(client, invalidStored)).toEqual(
          INVALID_STORED,
        );

        expect(await applyBackfill(client, SCHEMA, ours)).toBe(0);
        expect(await countUnset(client, SCHEMA)).toBe(unsetBefore - 4);
      });
    },
  );

  // A row can change between planning and apply (READ COMMITTED): the update
  // must match the values planning read, or it would write a stale proposal.
  const STALE_CHANGES = [
    ["plan", `"plan" = 'professional'`],
    ["maxAssets", `"maxAssets" = 500`],
    ["maxUsers", `"maxUsers" = 10`],
  ] as const;

  for (const [column, assignment] of STALE_CHANGES) {
    it(
      `skips a row whose ${column} changed after planning`,
      DB_TEST,
      async () => {
        await inRolledBackTransaction(async (client) => {
          const id = await insertOrg(client, {
            plan: "starter",
            maxAssets: 100,
            maxUsers: 3,
          });
          const planned = (
            await planBackfill(client, SCHEMA, { deploymentSelfHosted: false })
          ).filter((row) => row.id === id);
          expect(planned).toHaveLength(1);

          await client.query(
            `UPDATE ${t("organizations")} SET ${assignment} WHERE "id" = $1::uuid`,
            [id],
          );

          expect(await applyBackfill(client, SCHEMA, planned)).toBe(0);
          expect(await storedEntitlements(client, id)).toBeNull();

          // A fresh plan sees the changed values and may write them.
          const replanned = (
            await planBackfill(client, SCHEMA, { deploymentSelfHosted: false })
          ).filter((row) => row.id === id);
          expect(await applyBackfill(client, SCHEMA, replanned)).toBe(1);
          expect(await storedEntitlements(client, id)).toEqual(
            replanned[0].proposed,
          );
        });
      },
    );
  }

  it(
    "counts active users and assets and measures the limit against active users",
    DB_TEST,
    async () => {
      await inRolledBackTransaction(async (client) => {
        const atLimit = await insertOrg(client, {
          plan: "starter",
          maxAssets: 100,
          maxUsers: 2,
        });
        const aboveLimit = await insertOrg(client, {
          plan: "starter",
          maxAssets: 100,
          maxUsers: 1,
        });
        for (const org of [atLimit, aboveLimit]) {
          // Two active users and one inactive: 3 in total, 2 active.
          await insertUsers(client, org, [true, true, false]);
          await insertAsset(client, org);
        }

        const rows = await planBackfill(client, SCHEMA, {
          deploymentSelfHosted: false,
        });
        const byId = new Map(rows.map((row) => [row.id, row]));
        const usage = { assets: 1, users: 3, activeUsers: 2 };

        // 2 active users fit maxUsers 2; counting all 3 would wrongly flag it.
        expect(byId.get(atLimit)?.usage).toEqual(usage);
        expect(byId.get(atLimit)?.overLimit).toBe(false);
        expect(byId.get(aboveLimit)?.usage).toEqual(usage);
        expect(byId.get(aboveLimit)?.overLimit).toBe(true);
      });
    },
  );
});
