import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { getStripe } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import { getBaseUrl } from "@/lib/url";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const user = await requireApiAuth();
    if (!user.isAdmin || !user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { stripeCustomerId: true },
    });

    if (!org?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account" },
        { status: 400 },
      );
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${getBaseUrl()}/admin/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Billing portal error", { error });
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 },
    );
  }
}
