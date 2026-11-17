// Demo seed: three busy tenants for the hosted demo instance.
//
//   DATABASE_URL=postgresql://... DEMO_SEED_CONFIRM=yes node prisma/demo-seed.js
//
// Additive and re-runnable: it only touches organizations whose slug starts
// with "demo-". On every run it deletes the data of those organizations
// (children first, see prisma/demo-seed/cleanup.js) and recreates it. All
// other organizations, users and rows are left alone. Output is deterministic
// (faker seed 20261116 + tenant index); dates are relative to the start of
// today (UTC), or to DEMO_SEED_ANCHOR (ISO date) when set.
//
// Tenants
//   Northwind Logistics  demo-northwind  professional  ~250 assets
//   Brightside Dental    demo-brightside starter       ~60 assets
//   Helios Engineering   demo-helios     enterprise    ~400 assets
//
// Demo password (all users): DemoPass-2026!
// Logins (email / password), per tenant domain northwind.demo,
// brightside.demo and helios.demo:
//   admin@<domain>        organization admin
//   manager1@<domain>     asset manager (manager2, manager3 ...)
//   user01@<domain>       standard user (user02 ... user20 / user08 / user25)

const bcrypt = require("bcryptjs");
const { DEMO_ORGS } = require("./demo-seed/config");
const { buildOrgDataset, INSERT_PLAN } = require("./demo-seed/dataset");
const {
  cleanupDemoOrgs,
  findDemoOrgIds,
  CLEANUP_STEPS,
} = require("./demo-seed/cleanup");
const {
  assertDemoSeedConfirmed,
  requireDatabaseUrl,
  describeDatabaseTarget,
} = require("./demo-seed/guard");
const {
  createPrismaClient,
  findConflicts,
  insertDataset,
} = require("./demo-seed/database");

const DEMO_PASSWORD = "DemoPass-2026!";
const BCRYPT_COST = 12;

/** Start of today in UTC, or DEMO_SEED_ANCHOR when set. */
function resolveAnchor(env) {
  if (env.DEMO_SEED_ANCHOR) {
    const anchor = new Date(env.DEMO_SEED_ANCHOR);
    if (Number.isNaN(anchor.getTime())) {
      throw new Error("DEMO_SEED_ANCHOR is not a valid date.");
    }
    return anchor;
  }
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/** Builds the datasets of all demo tenants (no database access). */
function buildAllDatasets({ anchor, passwordHash }) {
  return DEMO_ORGS.map((def, index) =>
    buildOrgDataset(def, index, { anchor, passwordHash }),
  );
}

async function main() {
  assertDemoSeedConfirmed(process.env);
  const connectionString = requireDatabaseUrl(process.env);
  console.log(`Target database: ${describeDatabaseTarget(connectionString)}`);

  const anchor = resolveAnchor(process.env);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_COST);
  const datasets = buildAllDatasets({ anchor, passwordHash });

  const { prisma, pool } = createPrismaClient(connectionString);
  try {
    const existingIds = await findDemoOrgIds(prisma);
    console.log(`Found ${existingIds.length} existing demo organization(s).`);

    const conflicts = await findConflicts(prisma, datasets, existingIds);
    if (conflicts.length > 0) {
      throw new Error(
        `Demo data would collide with rows outside the demo organizations: ${conflicts.slice(0, 10).join(", ")}. Nothing was changed.`,
      );
    }

    const removed = await cleanupDemoOrgs(prisma, existingIds);
    const removedRows = removed.reduce((sum, step) => sum + step.count, 0);
    console.log(`Removed ${removedRows} existing demo row(s).`);

    for (const dataset of datasets) {
      const counts = await insertDataset(prisma, dataset);
      console.log(`Created ${dataset.key}:`, JSON.stringify(counts));
    }
    console.log(
      `Done. Sign in as admin@northwind.demo (or brightside/helios) with ${DEMO_PASSWORD}`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

module.exports = {
  DEMO_PASSWORD,
  DEMO_ORGS,
  INSERT_PLAN,
  CLEANUP_STEPS,
  resolveAnchor,
  buildAllDatasets,
  cleanupDemoOrgs,
  assertDemoSeedConfirmed,
  describeDatabaseTarget,
  main,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
