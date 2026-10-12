import type { ClientBase } from "pg";
import {
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
import { qualified } from "./db-target";

export interface BackfillRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  knownPlan: boolean;
  /** True when a non-null JSON value is stored; such rows are never touched. */
  entitlementsSet: boolean;
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

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  maxAssets: number;
  maxUsers: number;
  entitlementsSet: boolean;
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
      knownPlan: isLegacyPlan(row.plan),
      entitlementsSet: row.entitlementsSet,
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

/** Writes proposed entitlements to rows that have none. Idempotent. */
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
          AND ("entitlements" IS NULL OR "entitlements" = 'null'::jsonb)`,
      [JSON.stringify(row.proposed), row.id],
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
