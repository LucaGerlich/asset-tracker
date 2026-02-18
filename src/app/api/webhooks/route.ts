import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/api-auth';
import { webhookSchema } from '@/lib/validation-organization';
import { getWebhookEvents } from '@/lib/webhooks';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { z } from 'zod';
import crypto from 'crypto';
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";

const WEBHOOK_SORT_FIELDS = ["name", "url", "createdAt"];

export async function GET(req: NextRequest) {
  try {
    const authUser = await requirePermission('webhook:view');

    const searchParams = req.nextUrl.searchParams;

    // Get optional organization filter from user context
    const user = await prisma.user.findUnique({
      where: { userid: authUser.id! },
      select: { organizationId: true }
    });

    const where: Record<string, unknown> = user?.organizationId ? {
      OR: [
        { organizationId: user.organizationId },
        { organizationId: null }
      ]
    } : {};

    const include = {
      organization: {
        select: { id: true, name: true }
      },
      _count: {
        select: { deliveries: true }
      }
    };

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const webhooks = await prisma.webhook.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' }
      });
      return NextResponse.json(webhooks);
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, WEBHOOK_SORT_FIELDS);

    // Search filter
    if (params.search) {
      // Merge search OR with any existing OR (org scoping)
      const searchOR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { url: { contains: params.search, mode: "insensitive" } },
      ];
      if (where.OR) {
        // Wrap existing org-scoping OR and search OR in AND
        where.AND = [{ OR: where.OR as unknown[] }, { OR: searchOR }];
        delete where.OR;
      } else {
        where.OR = searchOR;
      }
    }

    const [webhooks, total] = await Promise.all([
      prisma.webhook.findMany({ where, include, ...prismaArgs }),
      prisma.webhook.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginatedResponse(webhooks, total, params),
      { status: 200 },
    );
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch webhooks' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await requirePermission('webhook:manage');

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
      where: { userid: authUser.id! },
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
      userId: authUser.id!,
      action: AUDIT_ACTIONS.CREATE,
      entity: 'Webhook',
      entityId: webhook.id,
      details: { name: webhook.name, url: webhook.url, events: webhook.events },
    });

    return NextResponse.json(webhook, { status: 201 });
  } catch (error) {
    console.error('Error creating webhook:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
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
