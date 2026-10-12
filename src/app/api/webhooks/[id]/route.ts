import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { updateWebhookSchema } from "@/lib/validation-organization";
import { getWebhookEvents } from "@/lib/webhooks";
import { toPublicWebhook } from "@/lib/webhook-response";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { z } from "zod";
import { encrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function webhookNotFound() {
  return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await requireApiAdmin();

    // Scope to user's organization to prevent cross-tenant access. A user
    // without an org owns no webhooks, so the filter can never widen.
    if (!user.organizationId) return webhookNotFound();
    const webhook = await prisma.webhook.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        deliveries: {
          take: 20,
          orderBy: { deliveredAt: "desc" },
        },
      },
    });

    if (!webhook) return webhookNotFound();

    return NextResponse.json(toPublicWebhook(webhook));
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error fetching webhook", { error });
    return NextResponse.json(
      { error: "Failed to fetch webhook" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const { id } = await params;
    const user = await requireApiAdmin();
    await requireWritableOrg(user);
    if (!user.organizationId) return webhookNotFound();

    const body = await req.json();
    const validated = updateWebhookSchema.parse(body);

    if (validated.events) {
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
    }

    // Encrypt the secret if it is being updated
    const data: Record<string, unknown> = {
      ...validated,
      updatedAt: new Date(),
    };
    if (validated.secret) {
      data.secret = encrypt(validated.secret);
    }

    // Verify webhook belongs to user's organization
    const existing = await prisma.webhook.findFirst({
      where: { id, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!existing) return webhookNotFound();

    const webhook = await prisma.webhook.update({
      where: { id },
      data,
    });

    await createAuditLog({
      userId: user.id!,
      action: AUDIT_ACTIONS.UPDATE,
      entity: "Webhook",
      entityId: webhook.id,
      details: validated as Record<string, unknown>,
    });

    return NextResponse.json(toPublicWebhook(webhook));
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error updating webhook", { error });
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to update webhook" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const { id } = await params;
    const user = await requireApiAdmin();
    await requireWritableOrg(user);
    if (!user.organizationId) return webhookNotFound();

    // Verify webhook belongs to user's organization
    const webhook = await prisma.webhook.findFirst({
      where: { id, organizationId: user.organizationId },
    });

    if (!webhook) return webhookNotFound();

    await prisma.webhook.delete({
      where: { id },
    });

    await createAuditLog({
      userId: user.id!,
      action: AUDIT_ACTIONS.DELETE,
      entity: "Webhook",
      entityId: id,
      details: { name: webhook.name, url: webhook.url },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error deleting webhook", { error });
    return NextResponse.json(
      { error: "Failed to delete webhook" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
