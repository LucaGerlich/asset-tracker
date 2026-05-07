/**
 * Plan feature definitions — shared between client and server.
 * No database imports — safe for "use client" components.
 */

export type PlanKey = "starter" | "professional" | "enterprise";

export type PlanFeature =
  | "sso"
  | "ldap"
  | "scim"
  | "advanced_reports"
  | "workflow_automation"
  | "custom_fields"
  | "api_keys"
  | "procurement"
  | "tco_dashboard"
  | "white_label";

const PROFESSIONAL_FEATURES: PlanFeature[] = [
  "sso",
  "advanced_reports",
  "workflow_automation",
  "custom_fields",
  "api_keys",
  "procurement",
  "tco_dashboard",
];

const ENTERPRISE_FEATURES: PlanFeature[] = [
  ...PROFESSIONAL_FEATURES,
  "ldap",
  "scim",
  "white_label",
];

const PLAN_FEATURES: Record<PlanKey, Set<PlanFeature>> = {
  starter: new Set(),
  professional: new Set(PROFESSIONAL_FEATURES),
  enterprise: new Set(ENTERPRISE_FEATURES),
};

/**
 * Get the set of features available on a given plan.
 */
export function getPlanFeatures(plan: PlanKey): Set<PlanFeature> {
  return PLAN_FEATURES[plan] ?? PLAN_FEATURES.starter;
}

/**
 * Get the minimum plan required for a given feature.
 */
export function getRequiredPlan(feature: PlanFeature): PlanKey {
  if (PLAN_FEATURES.starter.has(feature)) return "starter";
  if (PLAN_FEATURES.professional.has(feature)) return "professional";
  return "enterprise";
}

/**
 * Get display info for a plan (name, price, feature list).
 */
export function getPlanDisplayInfo(plan: PlanKey): {
  name: string;
  monthlyPrice: number;
  features: PlanFeature[];
} {
  const info: Record<
    PlanKey,
    { name: string; monthlyPrice: number; features: PlanFeature[] }
  > = {
    starter: { name: "Starter", monthlyPrice: 0, features: [] },
    professional: {
      name: "Professional",
      monthlyPrice: 29,
      features: PROFESSIONAL_FEATURES,
    },
    enterprise: {
      name: "Enterprise",
      monthlyPrice: 99,
      features: ENTERPRISE_FEATURES,
    },
  };
  return info[plan] ?? info.starter;
}

/**
 * Human-readable label for a plan feature.
 */
export const FEATURE_LABELS: Record<PlanFeature, string> = {
  sso: "Single Sign-On (SSO)",
  ldap: "LDAP Integration",
  scim: "SCIM Provisioning",
  advanced_reports: "Advanced Reports",
  workflow_automation: "Workflow Automation",
  custom_fields: "Custom Fields",
  api_keys: "API Keys",
  procurement: "Procurement Workflow",
  tco_dashboard: "TCO Dashboard",
  white_label: "White Label",
};
