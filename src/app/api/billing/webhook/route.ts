import { NextResponse } from "next/server";
import { getStripe, PLANS, PlanKey } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

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
    case "checkout.session.completed": {
      const session = event.data.object;
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
          },
        });
      }
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
            },
          });
        }
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
        },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
