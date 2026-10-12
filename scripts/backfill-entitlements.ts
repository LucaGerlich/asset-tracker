/**
 * Backfill organizations.entitlements from the legacy plan columns
 * (SaaS boundary phase 1a). Run only against the SaaS database.
 *
 * Dry run (the default; --dry-run says so explicitly), nothing is written:
 *   bun scripts/backfill-entitlements.ts --schema public --deployment-self-hosted false
 * Apply (--confirm must repeat the printed target; not valid without --apply):
 *   bun scripts/backfill-entitlements.ts --schema public --deployment-self-hosted false \
 *     --apply --confirm "host:5432/postgres/public"
 *
 * --deployment-self-hosted is the SELF_HOSTED value of the deployment that uses
 * this database (not of your shell); it decides the "currentAccess" column.
 * overLimit counts active users, as phase 1b will; 0.15.0 enforcement still
 * counts all users, and "usage" reports both.
 * The summary line counts "unset" rows (what --apply fills) and "invalid" rows
 * (a stored value that fails the entitlements schema: reported, never touched).
 * Phase 1b needs both at 0.
 * DATABASE_URL must name host, port and database explicitly (no host/port/dbname
 * query parameters), so the printed target is where the script really connects.
 * Bun loads .env automatically: check the printed target before applying.
 */
import pg from "pg";
import { assertColumns } from "./lib/db-target";
import {
  applyBackfill,
  countUnset,
  parseBackfillArgs,
  planBackfill,
  summarizeBackfill,
} from "./lib/backfill-entitlements";

// Every column planBackfill reads, so a wrong schema fails before any query runs.
const ORGANIZATION_COLUMNS = [
  "id",
  "name",
  "slug",
  "plan",
  "maxAssets",
  "maxUsers",
  "entitlements",
  "createdAt",
] as const;

async function main(): Promise<void> {
  const { connectionString, schema, deploymentSelfHosted, apply, target } =
    parseBackfillArgs(process.argv.slice(2), process.env);
  console.log(`Target: ${target}`);

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(apply ? "BEGIN" : "BEGIN READ ONLY");
    await assertColumns(client, schema, "organizations", ORGANIZATION_COLUMNS);
    await assertColumns(client, schema, "asset", ["organizationId"]);
    await assertColumns(client, schema, "user", ["organizationId", "isActive"]);
    const rows = await planBackfill(client, schema, { deploymentSelfHosted });
    for (const row of rows) console.log(JSON.stringify(row));
    const summary = summarizeBackfill(rows);
    console.log(JSON.stringify(summary));
    if (!apply) {
      await client.query("ROLLBACK");
      console.log("Dry run: nothing written.");
      return;
    }
    const updated = await applyBackfill(client, schema, rows);
    const remaining = await countUnset(client, schema);
    await client.query("COMMIT");
    console.log(
      `Updated ${updated} of ${summary.unset} organizations; ${remaining} still ` +
        "without entitlements (rows changed since planning are skipped: run again).",
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
