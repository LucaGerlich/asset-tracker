import {
  featuresInOrder,
  type Entitlements,
  type GatedFeature,
} from "@/lib/entitlements-shared";

/**
 * Legacy billing: Stripe inside the core and the plan, maxAssets and maxUsers
 * columns. Deleted in phase 3a of the SaaS boundary, once the control plane
 * owns billing. Free of server-only imports so scripts can use it.
 */

/** Legacy billing is active while the core holds a Stripe secret key. */
export function isLegacyBillingActive(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

const PROFESSIONAL_FEATURES: readonly GatedFeature[] = [
  "api_keys",
  "procurement",
  "advanced_reports",
  "workflow_automation",
  "custom_fields",
  "tco_dashboard",
];

const LEGACY_PLAN_FEATURES = {
  starter: [],
  professional: PROFESSIONAL_FEATURES,
  enterprise: [...PROFESSIONAL_FEATURES, "scim"],
} as const satisfies Record<string, readonly GatedFeature[]>;

export type LegacyPlan = keyof typeof LEGACY_PLAN_FEATURES;

/** The only features the core enforced per plan before entitlements existed. */
export const ENFORCED_BEFORE_ENTITLEMENTS: readonly GatedFeature[] = [
  "api_keys",
  "procurement",
];

export function isLegacyPlan(plan: string): plan is LegacyPlan {
  return Object.prototype.hasOwnProperty.call(LEGACY_PLAN_FEATURES, plan);
}

/**
 * Legacy limit columns use -1 (plan table, register) and 999999 (Stripe
 * webhook) for "unlimited". Any other negative value blocked everything under
 * the old check (count < max), so it maps to 0.
 */
export function legacyLimit(value: number): number | null {
  if (value === -1 || value >= 999999) return null;
  return value < 0 ? 0 : value;
}

/**
 * Entitlements equivalent to a legacy plan row. An unknown plan maps to
 * starter (no features); callers that can log should log it.
 */
export function legacyPlanToEntitlements(
  plan: string,
  maxAssets: number,
  maxUsers: number,
): Entitlements {
  const features = isLegacyPlan(plan)
    ? LEGACY_PLAN_FEATURES[plan]
    : LEGACY_PLAN_FEATURES.starter;
  return {
    features: featuresInOrder(features),
    maxAssets: legacyLimit(maxAssets),
    maxUsers: legacyLimit(maxUsers),
  };
}
