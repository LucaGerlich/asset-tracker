import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { updateWebhookSchema } from '@/lib/validation-organization';
import { getWebhookEvents } from '@/lib/webhooks';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const webhook = await prisma.webhook.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true }
        },
        deliveries: {
          take: 20,
          orderBy: { deliveredAt: 'desc' },
        }
      }
    });

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return NextResponse.json(webhook);
  } catch (error) {
    console.error('Error fetching webhook:', error);
    return NextResponse.json({ error: 'Failed to fetch webhook' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const validated = updateWebhookSchema.parse(body);

    // Validate events if provided
    if (validated.events) {
      const validEvents = getWebhookEvents().map(e => e.event);
      const invalidEvents = validated.events.filter(e => !validEvents.includes(e as typeof validEvents[number]));
      if (invalidEvents.length > 0) {
        return NextResponse.json({ 
          error: `Invalid events: ${invalidEvents.join(', ')}`,
          validEvents 
        }, { status: 400 });
      }
    }

    const webhook = await prisma.webhook.update({
      where: { id },
      data: {
        ...validated,
        updatedAt: new Date(),
      }
    });

    await createAuditLog({
      userId: session.user.id!,
      action: AUDIT_ACTIONS.UPDATE,
      entity: 'Webhook',
      entityId: webhook.id,
      details: validated as Record<string, unknown>,
    });

    return NextResponse.json(webhook);
  } catch (error) {
    console.error('Error updating webhook:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const webhook = await prisma.webhook.findUnique({
      where: { id }
    });

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    await prisma.webhook.delete({
      where: { id }
    });

    await createAuditLog({
      userId: session.user.id!,
      action: AUDIT_ACTIONS.DELETE,
      entity: 'Webhook',
      entityId: id,
      details: { name: webhook.name, url: webhook.url },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
