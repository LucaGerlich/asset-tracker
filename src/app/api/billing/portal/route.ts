import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { apiErrorResponse, ForbiddenError } from "@/lib/errors";
import { getStripe } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import { getBaseUrl } from "@/lib/url";
import { logger } from "@/lib/logger";

const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded";

export async function POST(req: Request) {
  try {
    // getAuthUser (not requireApiAuth) on purpose: admins of a read-only or
    // locked-out organization must still be able to pay to reactivate it.
    const user = await getAuthUser();
    if (!user.isAdmin) {
      throw new ForbiddenError("not_admin", "Admin access required");
    }
    if (!user.organizationId) {
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

    // The /suspended page posts a plain HTML form: send the browser straight on.
    if (req.headers.get("content-type")?.startsWith(FORM_CONTENT_TYPE)) {
      return NextResponse.redirect(session.url, 303);
    }

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
