import { parseArgs } from "node:util";
import type { ClientBase } from "pg";
import {
  entitlementsSchema,
  GATED_FEATURES,
  isOverLimit,
  type Entitlements,
  type GatedFeature,
} from "@/lib/entitlements-shared";
import {
  ENFORCED_BEFORE_ENTITLEMENTS,
  isLegacyPlan,
  legacyPlanToEntitlements,
} from "@/lib/legacy-billing";
import { describeTarget, parseSchemaName, qualified } from "./db-target";

export interface BackfillArgs {
  connectionString: string;
  schema: string;
  deploymentSelfHosted: boolean;
  apply: boolean;
  /** host:port/database/schema, exactly what --confirm must repeat to apply. */
  target: string;
}

function parseBoolean(name: string, value: string | undefined): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`--${name} must be true or false`);
}

/**
 * The CLI's argument and environment checks, kept pure so they can be tested.
 * Dry run is the default; --apply must repeat the printed target in --confirm.
 */
export function parseBackfillArgs(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): BackfillArgs {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      schema: { type: "string" },
      "deployment-self-hosted": { type: "string" },
      apply: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      confirm: { type: "string" },
    },
    strict: true,
  });
  const connectionString = env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const schema = parseSchemaName(values.schema);
  const deploymentSelfHosted = parseBoolean(
    "deployment-self-hosted",
    values["deployment-self-hosted"],
  );
  const apply = values.apply === true;
  if (apply && values["dry-run"]) {
    throw new Error("--dry-run and --apply cannot be combined");
  }
  if (values.confirm !== undefined && !apply) {
    throw new Error("--confirm is only valid together with --apply");
  }
  const target = describeTarget(connectionString, schema);
  if (apply && values.confirm !== target) {
    throw new Error(`--apply requires --confirm "${target}"`);
  }
  return { connectionString, schema, deploymentSelfHosted, apply, target };
}

export interface BackfillRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  /** The legacy limit columns as read; apply only writes while they are unchanged. */
  maxAssets: number;
  maxUsers: number;
  knownPlan: boolean;
  /** True when a non-null JSON value is stored; such rows are never touched. */
  entitlementsSet: boolean;
  /**
   * Whether the stored value passes the strict entitlements schema; null when
   * nothing is stored. An invalid value is reported, never overwritten.
   */
  storedValid: boolean | null;
  /** What the organization can use today, given real enforcement. */
  currentAccess: GatedFeature[];
  proposed: Entitlements;
  losesFeatures: GatedFeature[];
  usage: { assets: number; users: number; activeUsers: number };
  /** Usage above the proposed limits (active users only, as in phase 1b). */
  overLimit: boolean;
}

/**
 * Features an organization can use today. Self-hosted deployments allow
 * everything; otherwise only api_keys and procurement were checked per plan.
 */
export function currentAccessFor(
  plan: string,
  deploymentSelfHosted: boolean,
): GatedFeature[] {
  if (deploymentSelfHosted) return [...GATED_FEATURES];
  const planFeatures = new Set(legacyPlanToEntitlements(plan, 0, 0).features);
  return GATED_FEATURES.filter(
    (feature) =>
      !ENFORCED_BEFORE_ENTITLEMENTS.includes(feature) ||
      planFeatures.has(feature),
  );
}

/** Classifies a stored value; null when nothing is stored. Pure, so it is tested alone. */
export function storedEntitlementsValid(
  entitlementsSet: boolean,
  stored: unknown,
): boolean | null {
  if (!entitlementsSet) return null;
  return entitlementsSchema.safeParse(stored).success;
}

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  maxAssets: number;
  maxUsers: number;
  entitlementsSet: boolean;
  /** The stored JSON as pg parsed it; null for SQL NULL and for a JSON null. */
  stored: unknown;
  assets: number;
  users: number;
  activeUsers: number;
}

export async function planBackfill(
  client: ClientBase,
  schema: string,
  options: { deploymentSelfHosted: boolean },
): Promise<BackfillRow[]> {
  const result = await client.query<OrgRow>(
    `SELECT o."id", o."name", o."slug", o."plan", o."maxAssets", o."maxUsers",
            (o."entitlements" IS NOT NULL AND o."entitlements" <> 'null'::jsonb) AS "entitlementsSet",
            o."entitlements" AS "stored",
            (SELECT count(*) FROM ${qualified(schema, "asset")} a
              WHERE a."organizationId" = o."id")::int AS "assets",
            (SELECT count(*) FROM ${qualified(schema, "user")} u
              WHERE u."organizationId" = o."id")::int AS "users",
            (SELECT count(*) FROM ${qualified(schema, "user")} u
              WHERE u."organizationId" = o."id" AND u."isActive")::int AS "activeUsers"
       FROM ${qualified(schema, "organizations")} o
      ORDER BY o."createdAt", o."id"`,
  );
  return result.rows.map((row) => {
    const proposed = legacyPlanToEntitlements(
      row.plan,
      row.maxAssets,
      row.maxUsers,
    );
    const currentAccess = currentAccessFor(
      row.plan,
      options.deploymentSelfHosted,
    );
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      plan: row.plan,
      maxAssets: row.maxAssets,
      maxUsers: row.maxUsers,
      knownPlan: isLegacyPlan(row.plan),
      entitlementsSet: row.entitlementsSet,
      storedValid: storedEntitlementsValid(row.entitlementsSet, row.stored),
      currentAccess,
      proposed,
      losesFeatures: currentAccess.filter(
        (feature) => !proposed.features.includes(feature),
      ),
      usage: {
        assets: row.assets,
        users: row.users,
        activeUsers: row.activeUsers,
      },
      overLimit: isOverLimit(proposed, {
        assets: row.assets,
        users: row.activeUsers,
      }),
    };
  });
}

export interface BackfillSummary {
  organizations: number;
  /** Rows --apply fills. */
  unset: number;
  /** Rows whose stored value fails the schema: reported, never touched. */
  invalid: number;
  losingFeatures: number;
  overLimit: number;
  unknownPlans: string[];
}

/** The summary line the CLI prints; the gate to phase 1b is unset 0 and invalid 0. */
export function summarizeBackfill(
  rows: readonly BackfillRow[],
): BackfillSummary {
  return {
    organizations: rows.length,
    unset: rows.filter((row) => !row.entitlementsSet).length,
    invalid: rows.filter((row) => row.storedValid === false).length,
    losingFeatures: rows.filter((row) => row.losesFeatures.length > 0).length,
    overLimit: rows.filter((row) => row.overLimit).length,
    unknownPlans: rows.filter((row) => !row.knownPlan).map((row) => row.slug),
  };
}

/**
 * Writes proposed entitlements to rows that have none. Idempotent. The update
 * only matches while plan, maxAssets and maxUsers still equal what planning
 * read, so a row changed in between (a plan switch, say) is skipped, not
 * overwritten with a stale proposal; the caller sees it in the returned count.
 */
export async function applyBackfill(
  client: ClientBase,
  schema: string,
  rows: readonly BackfillRow[],
): Promise<number> {
  let updated = 0;
  for (const row of rows) {
    if (row.entitlementsSet) continue;
    const result = await client.query(
      `UPDATE ${qualified(schema, "organizations")}
          SET "entitlements" = $1::jsonb
        WHERE "id" = $2::uuid
          AND ("entitlements" IS NULL OR "entitlements" = 'null'::jsonb)
          AND "plan" = $3 AND "maxAssets" = $4 AND "maxUsers" = $5`,
      [
        JSON.stringify(row.proposed),
        row.id,
        row.plan,
        row.maxAssets,
        row.maxUsers,
      ],
    );
    updated += result.rowCount ?? 0;
  }
  return updated;
}

export async function countUnset(
  client: ClientBase,
  schema: string,
): Promise<number> {
  const result = await client.query<{ count: number }>(
    `SELECT count(*)::int AS "count" FROM ${qualified(schema, "organizations")}
      WHERE "entitlements" IS NULL OR "entitlements" = 'null'::jsonb`,
  );
  return result.rows[0].count;
}
