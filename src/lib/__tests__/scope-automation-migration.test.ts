import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

// Integration tests: run the real migration SQL against Postgres.
// Skipped when no DATABASE_URL is configured (they run in CI against a test DB).
// Every test runs inside a transaction that is rolled back, so nothing persists,
// but point DATABASE_URL at a throwaway database only: the single and zero
// organization cases first delete all organizations inside that transaction.
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

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
): Promise<void> {
  await tx.$executeRawUnsafe(
    `INSERT INTO ${table("custom_field_definitions")}
       ("id", "name", "fieldType", "entityType", "updatedAt")
     VALUES ($1::uuid, $2, 'text', 'asset', now())`,
    id,
    name,
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

/** Asset values of the given definitions, with the org of the field and of the asset. */
async function readAssetValues(
  tx: Tx,
  definitionNames: string[],
): Promise<ValueRow[]> {
  return tx.$queryRawUnsafe<ValueRow[]>(
    `SELECT v."value", v."fieldId",
            d."organizationId" AS "fieldOrganizationId",
            a."organizationId" AS "entityOrganizationId"
       FROM ${table("custom_field_values")} v
       JOIN ${table("custom_field_definitions")} d ON d."id" = v."fieldId"
       JOIN ${table("asset")} a ON a."assetid" = v."entityId"
      WHERE d."name" = ANY($1)
      ORDER BY v."value"`,
    definitionNames,
  );
}

describeDb("20261007_scope_automation_custom_fields backfill", () => {
  const backfill = extractBackfill(
    readMigration("20261007_scope_automation_custom_fields"),
  );

  it("attributes rules to their creator's org and definitions to the orgs using them", async () => {
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
      const sharedValues = await readAssetValues(tx, [names.shared]);
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
  });

  it("assigns everything to the only organization", async () => {
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

  it("leaves everything untouched when there are no organizations", async () => {
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
  });
});

describeDb("20261007b_reopen_billing_suspended_orgs", () => {
  const reopen = readMigration("20261007b_reopen_billing_suspended_orgs");

  it("reopens only organizations that were switched off together with a suspension", async () => {
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
  });
});
