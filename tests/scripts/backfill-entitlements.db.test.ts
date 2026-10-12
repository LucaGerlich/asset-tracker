import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import pg from "pg";
import {
  applyBackfill,
  countUnset,
  planBackfill,
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

        const rows = await planBackfill(client, SCHEMA, {
          deploymentSelfHosted: false,
        });
        const byId = new Map(rows.map((row) => [row.id, row]));

        expect(byId.get(starter)?.entitlementsSet).toBe(false);
        expect(byId.get(jsonNull)?.entitlementsSet).toBe(false);
        expect(byId.get(alreadySet)?.entitlementsSet).toBe(true);
        expect(byId.get(unknown)?.knownPlan).toBe(false);
        expect(byId.get(starter)?.losesFeatures).toEqual([
          "scim",
          "advanced_reports",
          "tco_dashboard",
          "custom_fields",
          "workflow_automation",
        ]);

        const ours = rows.filter((row) =>
          [starter, enterprise, unknown, jsonNull, alreadySet].includes(row.id),
        );
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

        expect(await applyBackfill(client, SCHEMA, ours)).toBe(0);
        expect(await countUnset(client, SCHEMA)).toBe(0);
      });
    },
  );

  it(
    "counts active users and assets and flags orgs over the proposed limits",
    DB_TEST,
    async () => {
      await inRolledBackTransaction(async (client) => {
        const org = await insertOrg(client, {
          plan: "starter",
          maxAssets: 100,
          maxUsers: 1,
        });
        for (const isActive of [true, true, false]) {
          await client.query(
            `INSERT INTO ${t("user")}
               ("userid", "firstname", "lastname", "creation_date", "canrequest", "isadmin", "isActive", "organizationId")
             VALUES ($1::uuid, 'T', 'U', now(), false, false, $2, $3::uuid)`,
            [randomUUID(), isActive, org],
          );
        }

        const rows = await planBackfill(client, SCHEMA, {
          deploymentSelfHosted: false,
        });
        const row = rows.find((candidate) => candidate.id === org);

        expect(row?.usage).toEqual({ assets: 0, users: 3, activeUsers: 2 });
        expect(row?.overLimit).toBe(true);
      });
    },
  );
});
