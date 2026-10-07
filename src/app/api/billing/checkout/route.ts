import { NextResponse } from "next/server";
import { getAuthUser, requireNotDemoMode } from "@/lib/api-auth";
import { apiErrorResponse, ForbiddenError } from "@/lib/errors";
import { getStripe, PLANS, PlanKey } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import { getBaseUrl } from "@/lib/url";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    // getAuthUser (not requireApiAuth) on purpose: admins of a read-only or
    // locked-out organization must still be able to pay to reactivate it.
    const user = await getAuthUser();
    if (!user.isAdmin) {
      throw new ForbiddenError("not_admin", "Admin access required");
    }

    const { plan } = (await req.json()) as { plan: PlanKey };
    if (!PLANS[plan] || !PLANS[plan].priceId) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const orgId = user.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const customer = await getStripe().customers.create({
        name: org.name,
        metadata: { organizationId: org.id },
      });
      customerId = customer.id;
      await prisma.organization.update({
        where: { id: org.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: PLANS[plan].priceId!, quantity: 1 }],
      success_url: `${getBaseUrl()}/dashboard?billing=success`,
      cancel_url: `${getBaseUrl()}/dashboard?billing=cancelled`,
      metadata: { organizationId: org.id, plan },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Billing checkout error", { error });
    return NextResponse.json(
      { error: "Failed to create checkout" },
      { status: 500 },
    );
  }
}
