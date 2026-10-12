import { z } from "zod";

/**
 * Per-organization entitlements: which gated features an organization may use
 * and its resource limits. Shared between client and server, so this module
 * must stay free of database and server-only imports.
 */

export const GATED_FEATURES = [
  "api_keys",
  "procurement",
  "scim",
  "advanced_reports",
  "tco_dashboard",
  "custom_fields",
  "workflow_automation",
] as const;

export type GatedFeature = (typeof GATED_FEATURES)[number];

/** A resource limit: a whole number of at least 0, or null for unlimited. */
const limitSchema = z.number().int().min(0).nullable();

/**
 * The strict shape used on every write path: unknown keys and unknown
 * features are rejected. Readers are lenient instead (phase 1b).
 */
export const entitlementsSchema = z.strictObject({
  features: z.array(z.enum(GATED_FEATURES)),
  maxAssets: limitSchema,
  maxUsers: limitSchema,
});

export type Entitlements = z.infer<typeof entitlementsSchema>;

/** Every feature, no limits: what self-hosted deployments always get. */
export const UNRESTRICTED: Entitlements = {
  features: [...GATED_FEATURES],
  maxAssets: null,
  maxUsers: null,
};

export const FEATURE_LABELS: Record<GatedFeature, string> = {
  api_keys: "API keys",
  procurement: "Procurement",
  scim: "SCIM provisioning",
  advanced_reports: "Advanced reports",
  tco_dashboard: "TCO dashboard",
  custom_fields: "Custom fields",
  workflow_automation: "Workflow automation",
};

export interface OrgUsage {
  assets: number;
  users: number;
}

/** True when usage is above a limit. Being exactly at a limit is not over it. */
export function isOverLimit(
  entitlements: Entitlements,
  usage: OrgUsage,
): boolean {
  return (
    (entitlements.maxAssets !== null &&
      usage.assets > entitlements.maxAssets) ||
    (entitlements.maxUsers !== null && usage.users > entitlements.maxUsers)
  );
}

/** Deduplicated features in GATED_FEATURES order, for stable stored values. */
export function featuresInOrder(
  features: Iterable<GatedFeature>,
): GatedFeature[] {
  const wanted = new Set(features);
  return GATED_FEATURES.filter((feature) => wanted.has(feature));
}
