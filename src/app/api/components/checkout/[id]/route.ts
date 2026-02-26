import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import {
  createAuditLog,
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
} from "@/lib/audit-log";
import { validateBody, componentCheckinSchema } from "@/lib/validations";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/components/checkout/[id]
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("component:view");

    const { id } = await params;

    const checkout = await prisma.componentCheckout.findUnique({
      where: { id },
      include: {
        component: {
          select: { id: true, name: true },
        },
        asset: {
          select: { assetid: true, assetname: true },
        },
      },
    });

    if (!checkout) {
      return NextResponse.json(
        { error: "Component checkout not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(checkout, { status: 200 });
  } catch (e: any) {
    logger.error("GET /api/components/checkout/[id] error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to fetch component checkout" },
      { status: 500 },
    );
  }
}

// PUT /api/components/checkout/[id] — Check-in (return) component
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("component:edit");

    const { id } = await params;
    const body = await req.json();
    const validated = validateBody(componentCheckinSchema, body);
    if (validated instanceof NextResponse) return validated;

    // Verify the checkout exists and hasn't already been returned
    const existing = await prisma.componentCheckout.findUnique({
      where: { id },
      include: {
        component: {
          select: { id: true, name: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Component checkout not found" },
        { status: 404 },
      );
    }

    if (existing.returnedAt) {
      return NextResponse.json(
        { error: "Component has already been returned" },
        { status: 400 },
      );
    }

    // Use a transaction to atomically increment stock and set returnedAt
    const checkin = await prisma.$transaction(async (tx) => {
      // Increment the component remaining quantity
      await tx.component.update({
        where: { id: existing.componentId },
        data: {
          remainingQuantity: {
            increment: existing.quantity,
          },
        },
      });

      // Mark the checkout as returned
      const updated = await tx.componentCheckout.update({
        where: { id },
        data: {
          returnedAt: new Date(),
        },
        include: {
          component: {
            select: { id: true, name: true },
          },
          asset: {
            select: { assetid: true, assetname: true },
          },
        },
      });

      return updated;
    });

    // Audit log
    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.COMPONENT,
      entityId: checkin.id,
      details: {
        type: "checkin",
        componentId: existing.componentId,
        componentName: existing.component.name,
        quantity: existing.quantity,
      },
    });

    // Webhook + integrations for check-in
    triggerWebhook("component.checked_in", {
      componentId: existing.componentId,
      componentName: existing.component.name,
      quantity: existing.quantity,
    }).catch(() => {});
    notifyIntegrations("component.checked_in", {
      componentName: existing.component.name,
      quantity: existing.quantity,
    }).catch(() => {});

    return NextResponse.json(checkin, { status: 200 });
  } catch (e: any) {
    logger.error("PUT /api/components/checkout/[id] error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Component checkout not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to check in component" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
