/**
 * Plan features — server-only module with DB access.
 * Re-exports shared types and pure functions.
 * For client components, import from plan-features-shared.ts instead.
 */

import prisma from "@/lib/prisma";
import { isSelfHosted } from "@/lib/deployment-mode";
import type { PlanKey } from "@/lib/stripe";
import { getPlanFeatures } from "./plan-features-shared";
import type { PlanFeature } from "./plan-features-shared";

// Re-export everything from the shared module for server-side convenience
export {
  type PlanFeature,
  getPlanFeatures,
  getRequiredPlan,
  getPlanDisplayInfo,
  FEATURE_LABELS,
} from "./plan-features-shared";

/**
 * Fetch the current plan for an organization.
 */
export async function getOrgPlan(organizationId: string): Promise<PlanKey> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  });
  return (org?.plan as PlanKey) ?? "starter";
}

/**
 * Check if a plan feature is enabled for the given organization.
 * Self-hosted mode: all features are always enabled.
 */
export async function isPlanFeatureEnabled(
  organizationId: string | null | undefined,
  feature: PlanFeature,
): Promise<boolean> {
  if (isSelfHosted()) return true;
  if (!organizationId) return false;

  const plan = await getOrgPlan(organizationId);
  return getPlanFeatures(plan).has(feature);
}
