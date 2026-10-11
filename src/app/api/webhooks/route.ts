import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requirePermission,
  requireNotDemoMode,
  requireSuperAdmin,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { webhookSchema } from "@/lib/validation-organization";
import { getWebhookEvents } from "@/lib/webhooks";
import { toPublicWebhook } from "@/lib/webhook-response";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { z } from "zod";
import crypto from "crypto";
import { encrypt } from "@/lib/encryption";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { logger } from "@/lib/logger";

const WEBHOOK_SORT_FIELDS = ["name", "url", "createdAt"];

export async function GET(req: NextRequest) {
  try {
    const authUser = await requirePermission("webhook:view");

    const searchParams = req.nextUrl.searchParams;

    // A caller without an org owns no webhooks: never widen the filter to
    // every org.
    if (!authUser.organizationId) {
      return NextResponse.json(
        searchParams.has("page")
          ? buildPaginatedResponse([], 0, parsePaginationParams(searchParams))
          : [],
      );
    }

    // Own org's webhooks plus global ones (no organization).
    const where: Record<string, unknown> = {
      OR: [
        { organizationId: authUser.organizationId },
        { organizationId: null },
      ],
    };

    const include = {
      organization: {
        select: { id: true, name: true },
      },
      _count: {
        select: { deliveries: true },
      },
    };

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const webhooks = await prisma.webhook.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(webhooks.map(toPublicWebhook));
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
      buildPaginatedResponse(webhooks.map(toPublicWebhook), total, params),
      { status: 200 },
    );
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error fetching webhooks", { error });
    return NextResponse.json(
      { error: "Failed to fetch webhooks" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const authUser = await requirePermission("webhook:manage");
    await requireWritableOrg(authUser);

    // A webhook without an organization is global and receives the events of
    // every tenant, so only a platform super-admin may create one.
    if (!authUser.organizationId) await requireSuperAdmin();

    const body = await req.json();
    const validated = webhookSchema.parse(body);

    const validEvents = getWebhookEvents().map((e) => e.event);
    const invalidEvents = validated.events.filter(
      (e) => !validEvents.includes(e as (typeof validEvents)[number]),
    );
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        {
          error: `Invalid events: ${invalidEvents.join(", ")}`,
          validEvents,
        },
        { status: 400 },
      );
    }

    // Generate a secret if not provided, then encrypt before storing
    const secret = validated.secret || crypto.randomBytes(32).toString("hex");

    const webhook = await prisma.webhook.create({
      data: {
        name: validated.name,
        url: validated.url,
        secret: encrypt(secret),
        events: validated.events,
        isActive: validated.isActive,
        retryAttempts: validated.retryAttempts,
        organizationId: authUser.organizationId ?? null,
      },
    });

    await createAuditLog({
      userId: authUser.id!,
      action: AUDIT_ACTIONS.CREATE,
      entity: "Webhook",
      entityId: webhook.id,
      details: { name: webhook.name, url: webhook.url, events: webhook.events },
    });

    return NextResponse.json(toPublicWebhook(webhook), { status: 201 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error creating webhook", { error });
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create webhook" },
      { status: 500 },
    );
  }
}

// List available webhook events
export async function OPTIONS() {
  try {
    await requirePermission("webhook:view");
    const events = getWebhookEvents();
    return NextResponse.json({ events });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    return NextResponse.json(
      { error: "Failed to fetch webhook events" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
