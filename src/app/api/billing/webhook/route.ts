import { NextResponse } from "next/server";
import { getStripe, PLANS, PlanKey } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { legacyPlanToEntitlements } from "@/lib/legacy-billing";

const PAYMENT_FAILED_STATUSES: ReadonlySet<string> = new Set([
  "past_due",
  "unpaid",
  "incomplete_expired",
]);

function isSessionSettled(paymentStatus: string | null | undefined): boolean {
  return paymentStatus === "paid" || paymentStatus === "no_payment_required";
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    logger.error("Webhook signature verification failed", { error: err });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      // A delayed payment method completes the session as "unpaid"; the plan is
      // only granted once the money is in (here or on async_payment_succeeded).
      if (!isSessionSettled(session.payment_status)) {
        logger.info("Checkout session completed without payment", {
          sessionId: session.id,
          paymentStatus: session.payment_status,
        });
        break;
      }
      const orgId = session.metadata?.organizationId;
      const plan = session.metadata?.plan as PlanKey;
      if (orgId && plan && PLANS[plan]) {
        await prisma.organization.update({
          where: { id: orgId },
          data: {
            plan,
            stripeSubscriptionId: session.subscription as string,
            maxAssets:
              PLANS[plan].maxAssets === -1 ? 999999 : PLANS[plan].maxAssets,
            maxUsers:
              PLANS[plan].maxUsers === -1 ? 999999 : PLANS[plan].maxUsers,
            // Phase 1a dual-write: nothing reads it yet (SaaS boundary spec, section 7).
            entitlements: legacyPlanToEntitlements(
              plan,
              PLANS[plan].maxAssets,
              PLANS[plan].maxUsers,
            ),
            // Stripe does not guarantee event order: customer.subscription.updated
            // can arrive first, find no org (the subscription id is stored here)
            // and clear nothing. isActive is the operator's lock and is left alone.
            suspendedAt: null,
          },
        });
      }
      break;
    }
    case "checkout.session.async_payment_failed": {
      const session = event.data.object;
      logger.warn("Checkout async payment failed; plan not granted", {
        sessionId: session.id,
        organizationId: session.metadata?.organizationId,
      });
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const org = await prisma.organization.findFirst({
        where: { stripeSubscriptionId: sub.id },
      });
      if (org && sub.status === "active") {
        // Determine the new plan from the subscription's price
        const priceId = sub.items?.data?.[0]?.price?.id;
        const newPlan = (
          Object.entries(PLANS) as [PlanKey, (typeof PLANS)[PlanKey]][]
        ).find(([, cfg]) => cfg.priceId === priceId);
        if (newPlan) {
          const [planKey, planCfg] = newPlan;
          await prisma.organization.update({
            where: { id: org.id },
            data: {
              plan: planKey,
              maxAssets: planCfg.maxAssets === -1 ? 999999 : planCfg.maxAssets,
              maxUsers: planCfg.maxUsers === -1 ? 999999 : planCfg.maxUsers,
              // Phase 1a dual-write: nothing reads it yet (SaaS boundary spec, section 7).
              entitlements: legacyPlanToEntitlements(
                planKey,
                planCfg.maxAssets,
                planCfg.maxUsers,
              ),
              // Clear the billing suspension. isActive is the operator's lock
              // and is deliberately left untouched here.
              suspendedAt: null,
            },
          });
        }
      }
      if (org && PAYMENT_FAILED_STATUSES.has(sub.status)) {
        // Same read-only grace period as a deleted subscription, but the plan
        // and subscription id stay so a successful retry reactivates the org.
        // An already running grace period is never restarted.
        await prisma.organization.updateMany({
          where: { stripeSubscriptionId: sub.id, suspendedAt: null },
          data: { suspendedAt: new Date() },
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      await prisma.organization.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: {
          plan: "starter",
          stripeSubscriptionId: null,
          maxAssets: PLANS.starter.maxAssets,
          maxUsers: PLANS.starter.maxUsers,
          // Phase 1a dual-write: nothing reads it yet (SaaS boundary spec, section 7).
          entitlements: legacyPlanToEntitlements(
            "starter",
            PLANS.starter.maxAssets,
            PLANS.starter.maxUsers,
          ),
          // Start the read-only grace period; the org locks out by time (see
          // getOrgStatus). isActive stays untouched: it is the operator's lock.
          suspendedAt: new Date(),
        },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
