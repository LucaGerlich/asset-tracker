/**
 * Backfill organizations.entitlements from the legacy plan columns
 * (SaaS boundary phase 1a). Run only against the SaaS database.
 *
 *   bun scripts/backfill-entitlements.ts --schema public --deployment-self-hosted false
 *   bun scripts/backfill-entitlements.ts --schema public --deployment-self-hosted false \
 *     --apply --confirm "host:5432/postgres/public"
 *
 * --deployment-self-hosted is the SELF_HOSTED value of the deployment that uses
 * this database (not of your shell); it decides the "currentAccess" column.
 * Bun loads .env automatically: check the printed target before applying.
 */
import { parseArgs } from "node:util";
import pg from "pg";
import {
  assertColumns,
  describeTarget,
  parseSchemaName,
} from "./lib/db-target";
import {
  applyBackfill,
  countUnset,
  planBackfill,
} from "./lib/backfill-entitlements";

const REQUIRED_COLUMNS = [
  "id",
  "slug",
  "plan",
  "maxAssets",
  "maxUsers",
  "entitlements",
] as const;

function parseBoolean(name: string, value: string | undefined): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`--${name} must be true or false`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      schema: { type: "string" },
      "deployment-self-hosted": { type: "string" },
      apply: { type: "boolean", default: false },
      confirm: { type: "string" },
    },
    strict: true,
  });
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const schema = parseSchemaName(values.schema);
  const deploymentSelfHosted = parseBoolean(
    "deployment-self-hosted",
    values["deployment-self-hosted"],
  );
  const target = describeTarget(connectionString, schema);
  console.log(`Target: ${target}`);
  if (values.apply && values.confirm !== target) {
    throw new Error(`--apply requires --confirm "${target}"`);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(values.apply ? "BEGIN" : "BEGIN READ ONLY");
    await assertColumns(client, schema, "organizations", REQUIRED_COLUMNS);
    const rows = await planBackfill(client, schema, { deploymentSelfHosted });
    for (const row of rows) console.log(JSON.stringify(row));
    console.log(
      JSON.stringify({
        organizations: rows.length,
        unset: rows.filter((row) => !row.entitlementsSet).length,
        losingFeatures: rows.filter((row) => row.losesFeatures.length > 0)
          .length,
        overLimit: rows.filter((row) => row.overLimit).length,
        unknownPlans: rows
          .filter((row) => !row.knownPlan)
          .map((row) => row.slug),
      }),
    );
    if (!values.apply) {
      await client.query("ROLLBACK");
      console.log("Dry run: nothing written.");
      return;
    }
    const updated = await applyBackfill(client, schema, rows);
    const remaining = await countUnset(client, schema);
    await client.query("COMMIT");
    console.log(
      `Updated ${updated} organizations; ${remaining} without entitlements.`,
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
