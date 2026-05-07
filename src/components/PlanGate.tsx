"use client";

import { type ReactNode } from "react";
import {
  type PlanFeature,
  type PlanKey,
  getPlanFeatures,
  getRequiredPlan,
  FEATURE_LABELS,
} from "@/lib/plan-features-shared";
import { UpgradeRequired } from "@/components/UpgradeRequired";

interface PlanGateProps {
  feature: PlanFeature;
  plan: PlanKey;
  isSelfHosted?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Conditionally render children based on the org's plan.
 * Shows an upgrade prompt if the feature isn't available on the current plan.
 * Self-hosted mode: always renders children.
 */
export function PlanGate({
  feature,
  plan,
  isSelfHosted = false,
  children,
  fallback,
}: PlanGateProps) {
  if (isSelfHosted) return <>{children}</>;

  const features = getPlanFeatures(plan);
  if (features.has(feature)) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  const requiredPlan = getRequiredPlan(feature);
  const label = FEATURE_LABELS[feature] ?? feature;

  return (
    <UpgradeRequired
      feature={label}
      requiredPlan={
        requiredPlan === "professional" ? "Professional" : "Enterprise"
      }
    />
  );
}
