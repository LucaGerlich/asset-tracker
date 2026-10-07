import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

// Integration tests: run the real migration SQL against Postgres.
// Every test runs inside a transaction that is rolled back, so nothing persists.
// They are still destructive while that transaction is open: the single and zero
// organization cases delete all organizations (cascading through dozens of
// tables, with row locks) and the backfills touch whole tables. So the suite only
// runs against a local database (CI uses localhost) or when explicitly opted in
// with ALLOW_DESTRUCTIVE_DB_TESTS=1. A DATABASE_URL that points at a shared or
// production database skips it.
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]", "::1"];

function isLocalDatabase(url: string): boolean {
  try {
    return LOCAL_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

const databaseUrl = process.env.DATABASE_URL;
const describeDb =
  databaseUrl &&
  (isLocalDatabase(databaseUrl) ||
    process.env.ALLOW_DESTRUCTIVE_DB_TESTS === "1")
    ? describe
    : describe.skip;

// vitest's 5s default must not abandon a test while its transaction is running.
const DB_TEST = { timeout: 30_000 };

const SCHEMA = process.env.DB_SCHEMA || "assettool";
const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");

const BACKFILL_START = "-- BACKFILL START";
const BACKFILL_END = "-- BACKFILL END";

type Tx = Prisma.TransactionClient;

class Rollback extends Error {}

/** Runs `fn` in a transaction and always rolls it back. Errors from `fn` surface. */
async function inRolledBackTransaction(
  fn: (tx: Tx) => Promise<void>,
): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await fn(tx);
        throw new Rollback();
      },
      { timeout: 30_000 },
    );
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

/** Mirrors prisma/set-schema.mjs: point the committed schema name at DB_SCHEMA. */
function forSchema(sql: string): string {
  return sql.replace(/"(?:public|assettool)"\./g, `"${SCHEMA}".`);
}

function readMigration(folder: string): string {
  return forSchema(
    readFileSync(join(MIGRATIONS_DIR, folder, "migration.sql"), "utf8"),
  );
}

function extractBackfill(sql: string): string {
  const start = sql.indexOf(BACKFILL_START);
  const end = sql.indexOf(BACKFILL_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Backfill markers missing from migration.sql");
  }
  return sql.slice(start + BACKFILL_START.length, end).trim();
}

const table = (name: string): string => `"${SCHEMA}"."${name}"`;

/** The entity tables that hold custom field values, as the backfill sees them. */
type EntityKind = {
  entityType: string;
  table: string;
  primaryKey: string;
};

const ASSET: EntityKind = {
  entityType: "asset",
  table: "asset",
  primaryKey: "assetid",
};
const KIT: EntityKind = { entityType: "kit", table: "kits", primaryKey: "id" };

async function insertOrganization(
  tx: Tx,
  id: string,
  ageInDays: number,
): Promise<void> {
  await tx.$executeRawUnsafe(
    `INSERT INTO ${table("organizations")} ("id", "name", "slug", "createdAt", "updatedAt")
     VALUES ($1::uuid, $2, $2, now() - make_interval(days => $3::int), now())`,
    id,
    `org-${id}`,
    ageInDays,
  );
}

async function insertUser(
  tx: Tx,
  id: string,
  organizationId: string | null,
): Promise<void> {
  await tx.$executeRawUnsafe(
    `INSERT INTO ${table("user")}
       ("userid", "firstname", "lastname", "creation_date", "canrequest", "isadmin", "organizationId")
     VALUES ($1::uuid, 'Test', 'User', now(), false, false, $2::uuid)`,
    id,
    organizationId,
  );
}

async function insertRule(
  tx: Tx,
  name: string,
  createdBy: string,
): Promise<void> {
  await tx.$executeRawUnsafe(
    `INSERT INTO ${table("automation_rules")}
       ("name", "trigger", "conditions", "actions", "createdBy", "updatedAt")
     VALUES ($1, 'warranty_expiring', '{}', '[]', $2::uuid, now())`,
    name,
    createdBy,
  );
}

async function insertDefinition(
  tx: Tx,
  id: string,
  name: string,
  entityType: string = ASSET.entityType,
): Promise<void> {
  await tx.$executeRawUnsafe(
    `INSERT INTO ${table("custom_field_definitions")}
       ("id", "name", "fieldType", "entityType", "updatedAt")
     VALUES ($1::uuid, $2, 'text', $3, now())`,
    id,
    name,
    entityType,
  );
}

async function insertAsset(
  tx: Tx,
  id: string,
  organizationId: string | null,
): Promise<void> {
  await tx.$executeRawUnsafe(
    `INSERT INTO ${table("asset")}
       ("assetid", "assetname", "assettag", "serialnumber", "creation_date", "organizationId")
     VALUES ($1::uuid, 'Test asset', $2, $2, now(), $3::uuid)`,
    id,
    `tag-${id}`,
    organizationId,
  );
}

async function insertKit(
  tx: Tx,
  id: string,
  organizationId: string,
): Promise<void> {
  await tx.$executeRawUnsafe(
    `INSERT INTO ${table("kits")} ("id", "name", "organizationId", "updatedAt")
     VALUES ($1::uuid, 'Test kit', $2::uuid, now())`,
    id,
    organizationId,
  );
}

async function insertValue(
  tx: Tx,
  fieldId: string,
  entityId: string,
  value: string,
): Promise<void> {
  await tx.$executeRawUnsafe(
    `INSERT INTO ${table("custom_field_values")} ("fieldId", "entityId", "value", "updatedAt")
     VALUES ($1::uuid, $2::uuid, $3, now())`,
    fieldId,
    entityId,
    value,
  );
}

type RuleRow = {
  name: string;
  organizationId: string | null;
  isActive: boolean;
};

async function readRules(tx: Tx, names: string[]): Promise<RuleRow[]> {
  return tx.$queryRawUnsafe<RuleRow[]>(
    `SELECT "name", "organizationId", "isActive"
       FROM ${table("automation_rules")} WHERE "name" = ANY($1) ORDER BY "name"`,
    names,
  );
}

type DefinitionRow = {
  id: string;
  name: string;
  organizationId: string | null;
};

async function readDefinitions(
  tx: Tx,
  names: string[],
): Promise<DefinitionRow[]> {
  return tx.$queryRawUnsafe<DefinitionRow[]>(
    `SELECT "id", "name", "organizationId"
       FROM ${table("custom_field_definitions")} WHERE "name" = ANY($1) ORDER BY "name", "createdAt"`,
    names,
  );
}

type ValueRow = {
  value: string;
  fieldId: string;
  fieldOrganizationId: string | null;
  entityOrganizationId: string | null;
};

/** Values of the given definitions, with the org of the field and of the entity holding it. */
async function readEntityValues(
  tx: Tx,
  definitionNames: string[],
  entity: EntityKind = ASSET,
): Promise<ValueRow[]> {
  return tx.$queryRawUnsafe<ValueRow[]>(
    `SELECT v."value", v."fieldId",
            d."organizationId" AS "fieldOrganizationId",
            e."organizationId" AS "entityOrganizationId"
       FROM ${table("custom_field_values")} v
       JOIN ${table("custom_field_definitions")} d ON d."id" = v."fieldId"
       JOIN ${table(entity.table)} e ON e."${entity.primaryKey}" = v."entityId"
      WHERE d."name" = ANY($1)
      ORDER BY v."value"`,
    definitionNames,
  );
}

describeDb("20261007_scope_automation_custom_fields backfill", () => {
  const backfill = extractBackfill(
    readMigration("20261007_scope_automation_custom_fields"),
  );

  it(
    "attributes rules to their creator's org and definitions to the orgs using them",
    DB_TEST,
    async () => {
      await inRolledBackTransaction(async (tx) => {
        const token = randomUUID();
        const orgA = randomUUID(); // older organization keeps the original rows
        const orgB = randomUUID();
        const userA = randomUUID();
        const userB = randomUUID();
        const userWithoutOrg = randomUUID();
        const assetA = randomUUID();
        const assetB1 = randomUUID();
        const assetB2 = randomUUID();
        const assetWithoutOrg = randomUUID();
        const sharedField = randomUUID(); // D: values on assets of both orgs
        const unusedField = randomUUID(); // U: no values
        const singleOrgField = randomUUID(); // values on org B assets only
        const orphanField = randomUUID(); // values only on an asset without org
        const names = {
          ruleA: `rule-a-${token}`,
          ruleB: `rule-b-${token}`,
          ruleWithoutOrg: `rule-none-${token}`,
          shared: `cf-shared-${token}`,
          unused: `cf-unused-${token}`,
          singleOrg: `cf-single-${token}`,
          orphan: `cf-orphan-${token}`,
        };

        await insertOrganization(tx, orgA, 2);
        await insertOrganization(tx, orgB, 1);
        await insertUser(tx, userA, orgA);
        await insertUser(tx, userB, orgB);
        await insertUser(tx, userWithoutOrg, null);
        await insertRule(tx, names.ruleA, userA);
        await insertRule(tx, names.ruleB, userB);
        await insertRule(tx, names.ruleWithoutOrg, userWithoutOrg);
        await insertAsset(tx, assetA, orgA);
        await insertAsset(tx, assetB1, orgB);
        await insertAsset(tx, assetB2, orgB);
        await insertAsset(tx, assetWithoutOrg, null);
        await insertDefinition(tx, sharedField, names.shared);
        await insertDefinition(tx, unusedField, names.unused);
        await insertDefinition(tx, singleOrgField, names.singleOrg);
        await insertDefinition(tx, orphanField, names.orphan);
        await insertValue(tx, sharedField, assetA, "a");
        await insertValue(tx, sharedField, assetB1, "b1");
        await insertValue(tx, sharedField, assetB2, "b2");
        await insertValue(tx, singleOrgField, assetB1, "single");
        await insertValue(tx, orphanField, assetWithoutOrg, "orphan");

        // Pre-migration state: nothing is scoped yet.
        await tx.$executeRawUnsafe(
          `UPDATE ${table("automation_rules")} SET "organizationId" = NULL WHERE "name" = ANY($1)`,
          [names.ruleA, names.ruleB, names.ruleWithoutOrg],
        );
        await tx.$executeRawUnsafe(
          `UPDATE ${table("custom_field_definitions")} SET "organizationId" = NULL WHERE "name" = ANY($1)`,
          [names.shared, names.unused, names.singleOrg, names.orphan],
        );

        await tx.$executeRawUnsafe(backfill);

        // Rules follow their creator; a creator without org leaves the rule off.
        const rules = await readRules(tx, [
          names.ruleA,
          names.ruleB,
          names.ruleWithoutOrg,
        ]);
        expect(rules).toEqual([
          { name: names.ruleA, organizationId: orgA, isActive: true },
          { name: names.ruleB, organizationId: orgB, isActive: true },
          { name: names.ruleWithoutOrg, organizationId: null, isActive: false },
        ]);

        // D exists once per org; the older org keeps the original row.
        const shared = await readDefinitions(tx, [names.shared]);
        expect(shared).toHaveLength(2);
        expect(shared.map((row) => row.organizationId).sort()).toEqual(
          [orgA, orgB].sort(),
        );
        const originalShared = shared.find((row) => row.id === sharedField);
        expect(originalShared?.organizationId).toBe(orgA);
        const clonedShared = shared.find((row) => row.id !== sharedField);
        expect(clonedShared?.organizationId).toBe(orgB);

        // Each org's values point at its own copy and none were lost.
        const sharedValues = await readEntityValues(tx, [names.shared]);
        expect(sharedValues).toEqual([
          {
            value: "a",
            fieldId: sharedField,
            fieldOrganizationId: orgA,
            entityOrganizationId: orgA,
          },
          {
            value: "b1",
            fieldId: clonedShared?.id,
            fieldOrganizationId: orgB,
            entityOrganizationId: orgB,
          },
          {
            value: "b2",
            fieldId: clonedShared?.id,
            fieldOrganizationId: orgB,
            entityOrganizationId: orgB,
          },
        ]);

        // A definition used by one org is assigned, not cloned.
        expect(await readDefinitions(tx, [names.singleOrg])).toEqual([
          { id: singleOrgField, name: names.singleOrg, organizationId: orgB },
        ]);

        // Definitions without attributable values stay unscoped.
        expect(await readDefinitions(tx, [names.unused])).toEqual([
          { id: unusedField, name: names.unused, organizationId: null },
        ]);
        expect(await readDefinitions(tx, [names.orphan])).toEqual([
          { id: orphanField, name: names.orphan, organizationId: null },
        ]);
      });
    },
  );

  it(
    "clones definitions of other entity types too (kit)",
    DB_TEST,
    async () => {
      await inRolledBackTransaction(async (tx) => {
        const orgA = randomUUID(); // older organization keeps the original row
        const orgB = randomUUID();
        const kitA = randomUUID();
        const kitB = randomUUID();
        const kitField = randomUUID();
        const name = `cf-kit-${randomUUID()}`;

        await insertOrganization(tx, orgA, 2);
        await insertOrganization(tx, orgB, 1);
        await insertKit(tx, kitA, orgA);
        await insertKit(tx, kitB, orgB);
        await insertDefinition(tx, kitField, name, KIT.entityType);
        await insertValue(tx, kitField, kitA, "kit-a");
        await insertValue(tx, kitField, kitB, "kit-b");

        await tx.$executeRawUnsafe(backfill);

        const definitions = await readDefinitions(tx, [name]);
        expect(definitions).toHaveLength(2);
        const original = definitions.find((row) => row.id === kitField);
        const clone = definitions.find((row) => row.id !== kitField);
        expect(original?.organizationId).toBe(orgA);
        expect(clone?.organizationId).toBe(orgB);

        expect(await readEntityValues(tx, [name], KIT)).toEqual([
          {
            value: "kit-a",
            fieldId: kitField,
            fieldOrganizationId: orgA,
            entityOrganizationId: orgA,
          },
          {
            value: "kit-b",
            fieldId: clone?.id,
            fieldOrganizationId: orgB,
            entityOrganizationId: orgB,
          },
        ]);
      });
    },
  );

  it(
    "gives each of three organizations its own copy of a shared definition",
    DB_TEST,
    async () => {
      await inRolledBackTransaction(async (tx) => {
        const orgA = randomUUID(); // oldest: keeps the original row
        const orgB = randomUUID();
        const orgC = randomUUID(); // newest
        const assetA = randomUUID();
        const assetB = randomUUID();
        const assetC1 = randomUUID();
        const assetC2 = randomUUID();
        const field = randomUUID();
        const name = `cf-three-${randomUUID()}`;

        await insertOrganization(tx, orgA, 3);
        await insertOrganization(tx, orgB, 2);
        await insertOrganization(tx, orgC, 1);
        await insertAsset(tx, assetA, orgA);
        await insertAsset(tx, assetB, orgB);
        await insertAsset(tx, assetC1, orgC);
        await insertAsset(tx, assetC2, orgC);
        await insertDefinition(tx, field, name);
        await insertValue(tx, field, assetA, "a");
        await insertValue(tx, field, assetB, "b");
        await insertValue(tx, field, assetC1, "c1");
        await insertValue(tx, field, assetC2, "c2");

        await tx.$executeRawUnsafe(backfill);

        // One copy per organization; the oldest one keeps the original id.
        const definitions = await readDefinitions(tx, [name]);
        expect(definitions).toHaveLength(3);
        const copyByOrg = new Map(
          definitions.map((row) => [row.organizationId, row.id]),
        );
        expect([...copyByOrg.keys()].sort()).toEqual([orgA, orgB, orgC].sort());
        expect(copyByOrg.get(orgA)).toBe(field);
        expect(new Set(copyByOrg.values()).size).toBe(3);

        // Every organization's values point at its own copy and none were lost.
        expect(await readEntityValues(tx, [name])).toEqual([
          {
            value: "a",
            fieldId: copyByOrg.get(orgA),
            fieldOrganizationId: orgA,
            entityOrganizationId: orgA,
          },
          {
            value: "b",
            fieldId: copyByOrg.get(orgB),
            fieldOrganizationId: orgB,
            entityOrganizationId: orgB,
          },
          {
            value: "c1",
            fieldId: copyByOrg.get(orgC),
            fieldOrganizationId: orgC,
            entityOrganizationId: orgC,
          },
          {
            value: "c2",
            fieldId: copyByOrg.get(orgC),
            fieldOrganizationId: orgC,
            entityOrganizationId: orgC,
          },
        ]);
      });
    },
  );

  it("assigns everything to the only organization", DB_TEST, async () => {
    await inRolledBackTransaction(async (tx) => {
      const token = randomUUID();
      const org = randomUUID();
      const user = randomUUID();
      const userWithoutOrg = randomUUID();
      const usedField = randomUUID();
      const unusedField = randomUUID();
      const asset = randomUUID();
      const names = {
        rule: `rule-${token}`,
        ruleWithoutOrg: `rule-none-${token}`,
        used: `cf-used-${token}`,
        unused: `cf-unused-${token}`,
      };

      // The block counts every organization in the database.
      await tx.$executeRawUnsafe(`DELETE FROM ${table("organizations")}`);
      await insertOrganization(tx, org, 0);
      await insertUser(tx, user, org);
      await insertUser(tx, userWithoutOrg, null);
      await insertRule(tx, names.rule, user);
      await insertRule(tx, names.ruleWithoutOrg, userWithoutOrg);
      await insertAsset(tx, asset, org);
      await insertDefinition(tx, usedField, names.used);
      await insertDefinition(tx, unusedField, names.unused);
      await insertValue(tx, usedField, asset, "value");

      await tx.$executeRawUnsafe(backfill);

      expect(await readRules(tx, [names.rule, names.ruleWithoutOrg])).toEqual([
        { name: names.rule, organizationId: org, isActive: true },
        { name: names.ruleWithoutOrg, organizationId: org, isActive: true },
      ]);
      expect(await readDefinitions(tx, [names.used, names.unused])).toEqual([
        { id: unusedField, name: names.unused, organizationId: org },
        { id: usedField, name: names.used, organizationId: org },
      ]);
    });
  });

  it(
    "leaves everything untouched when there are no organizations",
    DB_TEST,
    async () => {
      await inRolledBackTransaction(async (tx) => {
        const token = randomUUID();
        const userWithoutOrg = randomUUID();
        const field = randomUUID();
        const names = { rule: `rule-${token}`, field: `cf-${token}` };

        await tx.$executeRawUnsafe(`DELETE FROM ${table("organizations")}`);
        await insertUser(tx, userWithoutOrg, null);
        await insertRule(tx, names.rule, userWithoutOrg);
        await insertDefinition(tx, field, names.field);

        await tx.$executeRawUnsafe(backfill);

        expect(await readRules(tx, [names.rule])).toEqual([
          { name: names.rule, organizationId: null, isActive: true },
        ]);
        expect(await readDefinitions(tx, [names.field])).toEqual([
          { id: field, name: names.field, organizationId: null },
        ]);
      });
    },
  );
});

describeDb("20261007b_reopen_billing_suspended_orgs", () => {
  const reopen = readMigration("20261007b_reopen_billing_suspended_orgs");

  it(
    "reopens only organizations that were switched off together with a suspension",
    DB_TEST,
    async () => {
      await inRolledBackTransaction(async (tx) => {
        const billingSuspended = randomUUID();
        const operatorLocked = randomUUID();

        await insertOrganization(tx, billingSuspended, 0);
        await insertOrganization(tx, operatorLocked, 0);
        await tx.$executeRawUnsafe(
          `UPDATE ${table("organizations")}
            SET "isActive" = false, "suspendedAt" = now()
          WHERE "id" = $1::uuid`,
          billingSuspended,
        );
        await tx.$executeRawUnsafe(
          `UPDATE ${table("organizations")}
            SET "isActive" = false, "suspendedAt" = NULL
          WHERE "id" = $1::uuid`,
          operatorLocked,
        );

        await tx.$executeRawUnsafe(reopen);

        const rows = await tx.$queryRawUnsafe<
          { id: string; isActive: boolean; suspendedAt: Date | null }[]
        >(
          `SELECT "id", "isActive", "suspendedAt" FROM ${table("organizations")}
          WHERE "id" = ANY($1::uuid[]) ORDER BY "id"`,
          [billingSuspended, operatorLocked],
        );
        const byId = new Map(rows.map((row) => [row.id, row]));

        // Reopened, still marked as suspended so the 14-day read-only grace applies.
        expect(byId.get(billingSuspended)?.isActive).toBe(true);
        expect(byId.get(billingSuspended)?.suspendedAt).not.toBeNull();
        // An operator lock (no suspendedAt) stays locked.
        expect(byId.get(operatorLocked)?.isActive).toBe(false);
      });
    },
  );
});
