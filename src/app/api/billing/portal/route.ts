import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { getStripe } from '@/lib/stripe';
import prisma from '@/lib/prisma';

export async function POST() {
  try {
    const user = await requireApiAuth();
    if (!user.isAdmin || !user.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { stripeCustomerId: true },
    });

    if (!org?.stripeCustomerId) {
      return NextResponse.json({ error: 'No billing account' }, { status: 400 });
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${process.env.NEXTAUTH_URL}/admin/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Billing portal error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
  }
}
