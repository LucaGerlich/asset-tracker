import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { webhookSchema } from '@/lib/validation-organization';
import { getWebhookEvents } from '@/lib/webhooks';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { z } from 'zod';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get optional organization filter from user context
    const user = await prisma.user.findUnique({
      where: { userid: session.user.id! },
      select: { organizationId: true }
    });

    const webhooks = await prisma.webhook.findMany({
      where: user?.organizationId ? {
        OR: [
          { organizationId: user.organizationId },
          { organizationId: null }
        ]
      } : {},
      include: {
        organization: {
          select: { id: true, name: true }
        },
        _count: {
          select: { deliveries: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(webhooks);
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return NextResponse.json({ error: 'Failed to fetch webhooks' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const validated = webhookSchema.parse(body);

    // Validate that all events are valid
    const validEvents = getWebhookEvents().map(e => e.event);
    const invalidEvents = validated.events.filter(e => !validEvents.includes(e as typeof validEvents[number]));
    if (invalidEvents.length > 0) {
      return NextResponse.json({ 
        error: `Invalid events: ${invalidEvents.join(', ')}`,
        validEvents 
      }, { status: 400 });
    }

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { userid: session.user.id! },
      select: { organizationId: true }
    });

    // Generate a secret if not provided
    const secret = validated.secret || crypto.randomBytes(32).toString('hex');

    const webhook = await prisma.webhook.create({
      data: {
        name: validated.name,
        url: validated.url,
        secret,
        events: validated.events,
        isActive: validated.isActive,
        retryAttempts: validated.retryAttempts,
        organizationId: user?.organizationId || null,
      }
    });

    await createAuditLog({
      userId: session.user.id!,
      action: AUDIT_ACTIONS.CREATE,
      entity: 'Webhook',
      entityId: webhook.id,
      details: { name: webhook.name, url: webhook.url, events: webhook.events },
    });

    return NextResponse.json(webhook, { status: 201 });
  } catch (error) {
    console.error('Error creating webhook:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
  }
}

// List available webhook events
export async function OPTIONS() {
  const events = getWebhookEvents();
  return NextResponse.json({ events });
}

export const dynamic = 'force-dynamic';
