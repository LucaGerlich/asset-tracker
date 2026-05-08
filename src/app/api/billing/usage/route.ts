import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { PLANS } from "@/lib/stripe";
import { getPlanFeatures, getPlanDisplayInfo } from "@/lib/plan-features";
import type { PlanKey } from "@/lib/plan-features-shared";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const user = await requireApiAdmin();

    if (!user.organizationId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        plan: true,
        maxAssets: true,
        maxUsers: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        trialEndsAt: true,
      },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    const plan = (org.plan as PlanKey) || "starter";
    const planInfo = getPlanDisplayInfo(plan);
    const features = Array.from(getPlanFeatures(plan));

    const [assetCount, userCount] = await Promise.all([
      prisma.asset.count({ where: { organizationId: user.organizationId } }),
      prisma.user.count({ where: { organizationId: user.organizationId } }),
    ]);

    // Use plan-defined limits as the source of truth.
    // Fall back to stored values only if they're higher (custom override).
    const planConfig = PLANS[plan] ?? PLANS.starter;
    const planMaxAssets =
      planConfig.maxAssets === -1 ? -1 : planConfig.maxAssets;
    const planMaxUsers = planConfig.maxUsers === -1 ? -1 : planConfig.maxUsers;
    const storedMaxAssets =
      org.maxAssets === -1 || org.maxAssets >= 999999 ? -1 : org.maxAssets;
    const storedMaxUsers =
      org.maxUsers === -1 || org.maxUsers >= 999999 ? -1 : org.maxUsers;

    // Use whichever is more generous (plan def or stored value)
    const maxAssets =
      planMaxAssets === -1 || storedMaxAssets === -1
        ? -1
        : Math.max(planMaxAssets, storedMaxAssets);
    const maxUsers =
      planMaxUsers === -1 || storedMaxUsers === -1
        ? -1
        : Math.max(planMaxUsers, storedMaxUsers);

    return NextResponse.json({
      plan,
      planName: planInfo.name,
      monthlyPrice: planInfo.monthlyPrice,
      assets: {
        current: assetCount,
        max: maxAssets,
        percentage:
          maxAssets === -1 ? 0 : Math.round((assetCount / maxAssets) * 100),
      },
      users: {
        current: userCount,
        max: maxUsers,
        percentage:
          maxUsers === -1 ? 0 : Math.round((userCount / maxUsers) * 100),
      },
      features,
      hasStripe: !!org.stripeCustomerId,
      hasSubscription: !!org.stripeSubscriptionId,
      trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
    });
  } catch (error) {
    logger.error("GET /api/billing/usage error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch billing usage" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
