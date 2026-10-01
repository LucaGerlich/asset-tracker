import { NextResponse } from "next/server";
import { isValidCronAuth } from "@/lib/cron-auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { PLANS } from "@/lib/stripe";
import { logger } from "@/lib/logger";

/**
 * GET /api/cron/check-trials
 * Daily cron: downgrade expired trial organizations to the starter plan.
 * Secured by CRON_SECRET header.
 */
export async function GET() {
  const hdrs = await headers();
  const authHeader = hdrs.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!isValidCronAuth(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find orgs with expired trials that haven't subscribed
    const expiredTrialOrgs = await prisma.organization.findMany({
      where: {
        trialEndsAt: { lt: new Date() },
        plan: "professional",
        stripeSubscriptionId: null,
      },
      select: { id: true, name: true, trialEndsAt: true },
    });

    if (expiredTrialOrgs.length === 0) {
      return NextResponse.json({ downgraded: 0 });
    }

    // Downgrade all expired trial orgs to starter
    const result = await prisma.organization.updateMany({
      where: {
        id: { in: expiredTrialOrgs.map((o) => o.id) },
      },
      data: {
        plan: "starter",
        trialEndsAt: null,
        maxAssets: PLANS.starter.maxAssets,
        maxUsers: PLANS.starter.maxUsers,
      },
    });

    logger.info("Trial check complete", {
      downgraded: result.count,
      orgs: expiredTrialOrgs.map((o) => o.name),
    });

    return NextResponse.json({
      downgraded: result.count,
      orgs: expiredTrialOrgs.map((o) => ({
        id: o.id,
        name: o.name,
      })),
    });
  } catch (error) {
    logger.error("Trial check cron error", { error });
    return NextResponse.json({ error: "Trial check failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
