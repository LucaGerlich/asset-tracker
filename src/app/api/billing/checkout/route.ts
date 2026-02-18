import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { getStripe, PLANS, PlanKey } from '@/lib/stripe';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const user = await requireApiAuth();
    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { plan } = await req.json() as { plan: PlanKey };
    if (!PLANS[plan] || !PLANS[plan].priceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const orgId = user.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get or create Stripe customer
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
      mode: 'subscription',
      line_items: [{ price: PLANS[plan].priceId!, quantity: 1 }],
      success_url: `${process.env.NEXTAUTH_URL}/dashboard?billing=success`,
      cancel_url: `${process.env.NEXTAUTH_URL}/dashboard?billing=cancelled`,
      metadata: { organizationId: org.id, plan },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Billing checkout error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 });
  }
}
