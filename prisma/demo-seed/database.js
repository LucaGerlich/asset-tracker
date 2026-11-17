// Database access of the demo seed: client creation, preflight checks and
// chunked inserts. Everything else in this folder is database-free.

const { INSERT_PLAN } = require("./dataset");
const { chunk } = require("./util");

const INSERT_CHUNK_SIZE = 500;
const LOOKUP_CHUNK_SIZE = 200;

/** Creates a Prisma client on a pg pool, configured like prisma/seed.js. */
function createPrismaClient(connectionString) {
  // Required lazily so that tests can load the other modules without them.
  const { PrismaClient } = require("@prisma/client");
  const { PrismaPg } = require("@prisma/adapter-pg");
  const pg = require("pg");

  const isCloudDatabase =
    process.env.DATABASE_SSL === "true" ||
    connectionString.includes("supabase") ||
    connectionString.includes("pooler.supabase");
  const pool = new pg.Pool({
    connectionString,
    ssl: isCloudDatabase ? { rejectUnauthorized: false } : false,
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  return { prisma, pool };
}

/**
 * Finds globally unique values (emails, usernames, asset tags, serial
 * numbers) the seed would insert that already belong to a row outside the
 * demo organizations. Checked before anything is deleted.
 */
async function findConflicts(prisma, datasets, demoOrgIds) {
  const demoIds = new Set(demoOrgIds);
  const isForeign = (row) => !demoIds.has(row.organizationId);
  const conflicts = [];
  const rows = (key) => datasets.flatMap((set) => set.data[key]);

  const lookups = [
    {
      label: "user email",
      values: rows("users").map((user) => user.email),
      find: (values) =>
        prisma.user.findMany({
          where: { email: { in: values } },
          select: { email: true, organizationId: true },
        }),
      read: (row) => row.email,
    },
    {
      label: "username",
      values: rows("users").map((user) => user.username),
      find: (values) =>
        prisma.user.findMany({
          where: { username: { in: values } },
          select: { username: true, organizationId: true },
        }),
      read: (row) => row.username,
    },
    {
      label: "asset tag",
      values: rows("assets").map((asset) => asset.assettag),
      find: (values) =>
        prisma.asset.findMany({
          where: { assettag: { in: values } },
          select: { assettag: true, organizationId: true },
        }),
      read: (row) => row.assettag,
    },
    {
      label: "serial number",
      values: rows("assets").map((asset) => asset.serialnumber),
      find: (values) =>
        prisma.asset.findMany({
          where: { serialnumber: { in: values } },
          select: { serialnumber: true, organizationId: true },
        }),
      read: (row) => row.serialnumber,
    },
  ];

  for (const lookup of lookups) {
    for (const values of chunk(lookup.values, LOOKUP_CHUNK_SIZE)) {
      const found = await lookup.find(values);
      for (const row of found.filter(isForeign)) {
        conflicts.push(`${lookup.label} ${lookup.read(row)}`);
      }
    }
  }
  return conflicts;
}

/** Writes one tenant with createMany in dependency order. */
async function insertDataset(prisma, dataset) {
  const counts = {};
  for (const [delegate, key] of INSERT_PLAN) {
    const rows = dataset.data[key];
    counts[key] = rows.length;
    for (const part of chunk(rows, INSERT_CHUNK_SIZE)) {
      await prisma[delegate].createMany({ data: part });
    }
  }
  return counts;
}

module.exports = { createPrismaClient, findConflicts, insertDataset };
