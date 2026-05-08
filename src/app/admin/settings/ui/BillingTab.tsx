"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CreditCard,
  ExternalLink,
  TrendingUp,
  Users,
  HardDrive,
  Clock,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  type PlanFeature,
  FEATURE_LABELS,
  getPlanFeatures,
} from "@/lib/plan-features-shared";

interface UsageData {
  plan: string;
  planName: string;
  monthlyPrice: number;
  assets: { current: number; max: number; percentage: number };
  users: { current: number; max: number; percentage: number };
  features: PlanFeature[];
  hasStripe: boolean;
  hasSubscription: boolean;
  trialEndsAt: string | null;
}

const PLAN_ORDER = ["starter", "professional", "enterprise"] as const;

export default function BillingTab() {
  const [data, setData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    fetch("/api/billing/usage")
      .then((res) => res.json())
      .then(setData)
      .catch(() => toast.error("Failed to load billing data"))
      .finally(() => setIsLoading(false));
  }, []);

  const handleUpgrade = async (plan: string) => {
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const result = await res.json();
      if (result.url) {
        window.location.href = result.url;
      } else {
        toast.error(result.error || "Failed to start checkout");
      }
    } catch {
      toast.error("Failed to start checkout");
    }
  };

  const handleManage = async () => {
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const result = await res.json();
      if (result.url) {
        window.location.href = result.url;
      } else {
        toast.error("Failed to open billing portal");
      }
    } catch {
      toast.error("Failed to open billing portal");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="bg-muted h-32 animate-pulse rounded-lg" />
        <div className="bg-muted h-48 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!data) return null;

  const trialDaysLeft = data.trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(data.trialEndsAt).getTime() - now) / (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  const isTrialActive =
    trialDaysLeft !== null && trialDaysLeft > 0 && !data.hasSubscription;

  return (
    <div className="space-y-6">
      {/* Trial banner */}
      {isTrialActive && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
          <CardContent className="flex items-center gap-3 py-4">
            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Professional trial — {trialDaysLeft} day
                {trialDaysLeft !== 1 ? "s" : ""} remaining
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Upgrade now to keep all Professional features after the trial
                ends.
              </p>
            </div>
            <Button size="sm" onClick={() => handleUpgrade("professional")}>
              Upgrade
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Current plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Current Plan
              </CardTitle>
              <CardDescription>
                Your organization&apos;s subscription and usage
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={data.plan === "starter" ? "secondary" : "default"}
                className="text-sm"
              >
                {data.planName}
              </Badge>
              {data.monthlyPrice > 0 && (
                <span className="text-muted-foreground text-sm">
                  ${data.monthlyPrice}/mo
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Usage bars */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5">
                  <HardDrive className="h-4 w-4" />
                  Assets
                </span>
                <span className="text-muted-foreground">
                  {data.assets.current}
                  {data.assets.max === -1
                    ? " / Unlimited"
                    : ` / ${data.assets.max}`}
                </span>
              </div>
              <Progress
                value={data.assets.max === -1 ? 5 : data.assets.percentage}
                className="h-2"
              />
              {data.assets.max !== -1 && data.assets.percentage >= 90 && (
                <p className="text-destructive text-xs">
                  Approaching limit — upgrade to add more assets
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  Users
                </span>
                <span className="text-muted-foreground">
                  {data.users.current}
                  {data.users.max === -1
                    ? " / Unlimited"
                    : ` / ${data.users.max}`}
                </span>
              </div>
              <Progress
                value={data.users.max === -1 ? 5 : data.users.percentage}
                className="h-2"
              />
              {data.users.max !== -1 && data.users.percentage >= 90 && (
                <p className="text-destructive text-xs">
                  Approaching limit — upgrade to invite more users
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {data.hasSubscription ? (
              <Button variant="outline" onClick={handleManage}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Manage Subscription
              </Button>
            ) : (
              data.plan === "starter" && (
                <Button onClick={() => handleUpgrade("professional")}>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Upgrade to Professional
                </Button>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Comparison</CardTitle>
          <CardDescription>
            See what&apos;s included in each plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {PLAN_ORDER.map((planKey) => {
              const features = getPlanFeatures(planKey);
              const isCurrent = data.plan === planKey;
              const planNames: Record<string, string> = {
                starter: "Starter",
                professional: "Professional",
                enterprise: "Enterprise",
              };
              const planPrices: Record<string, string> = {
                starter: "Free",
                professional: "$29/mo",
                enterprise: "$99/mo",
              };
              const planLimits: Record<string, string> = {
                starter: "100 assets, 3 users",
                professional: "5,000 assets, 25 users",
                enterprise: "Unlimited",
              };

              return (
                <div
                  key={planKey}
                  className={`rounded-lg border p-4 ${
                    isCurrent ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold">{planNames[planKey]}</h3>
                    {isCurrent && (
                      <Badge variant="default" className="text-xs">
                        Current
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground mb-1 text-lg font-bold">
                    {planPrices[planKey]}
                  </p>
                  <p className="text-muted-foreground mb-4 text-xs">
                    {planLimits[planKey]}
                  </p>

                  <ul className="space-y-1.5 text-sm">
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-green-600" />
                      Asset Management
                    </li>
                    {Array.from(features).map((f) => (
                      <li key={f} className="flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-green-600" />
                        {FEATURE_LABELS[f]}
                      </li>
                    ))}
                  </ul>

                  {!isCurrent && planKey !== "starter" && (
                    <Button
                      size="sm"
                      variant={
                        planKey === "professional" ? "default" : "outline"
                      }
                      className="mt-4 w-full"
                      onClick={() => handleUpgrade(planKey)}
                    >
                      Upgrade
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
