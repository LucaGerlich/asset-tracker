import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { validateBody, componentCheckoutSchema } from "@/lib/validation";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";
import { logger } from "@/lib/logger";

// GET /api/components/checkout?componentId=...
export async function GET(req: Request) {
  try {
    await requirePermission("component:view");

    const { searchParams } = new URL(req.url);
    const componentId = searchParams.get("componentId");

    const where = componentId ? { componentId } : {};

    const checkouts = await prisma.componentCheckout.findMany({
      where,
      orderBy: { checkedOutAt: "desc" },
      include: {
        component: {
          select: {
            id: true,
            name: true,
          },
        },
        asset: {
          select: {
            assetid: true,
            assetname: true,
          },
        },
      },
    });

    return NextResponse.json(checkouts, { status: 200 });
  } catch (e: any) {
    logger.error("GET /api/components/checkout error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to fetch component checkouts" },
      { status: 500 },
    );
  }
}

// POST /api/components/checkout
export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("component:edit");

    const body = await req.json();
    const validated = validateBody(componentCheckoutSchema, body);
    if (validated instanceof NextResponse) return validated;

    const { componentId, assetId, quantity, notes } = validated;

    // Verify the component exists and has sufficient stock
    const component = await prisma.component.findUnique({
      where: { id: componentId },
    });

    if (!component) {
      return NextResponse.json(
        { error: "Component not found" },
        { status: 404 },
      );
    }

    if (component.remainingQuantity < quantity) {
      return NextResponse.json(
        {
          error: "Insufficient stock",
          available: component.remainingQuantity,
          requested: quantity,
        },
        { status: 400 },
      );
    }

    // Use a transaction to atomically decrement stock and create checkout
    const checkout = await prisma.$transaction(async (tx) => {
      // Decrement the component remaining quantity
      await tx.component.update({
        where: { id: componentId },
        data: {
          remainingQuantity: {
            decrement: quantity,
          },
        },
      });

      // Create the checkout record
      const created = await tx.componentCheckout.create({
        data: {
          componentId,
          assetId,
          quantity,
          checkedOutBy: authUser.id,
          notes: notes || null,
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

      return created;
    });

    // Audit log
    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.COMPONENT,
      entityId: checkout.id,
      details: {
        type: "checkout",
        componentId,
        assetId,
        quantity,
        componentName: component.name,
      },
    });

    // Webhook + integrations for checkout
    triggerWebhook("component.checked_out", {
      componentId,
      componentName: component.name,
      assetId,
      quantity,
    }).catch(() => {});
    notifyIntegrations("component.checked_out", {
      componentName: component.name,
      quantity,
    }).catch(() => {});

    // Check remaining stock after checkout and trigger low stock alerts
    const remainingStock = component.remainingQuantity - quantity;
    const minQty = component.minQuantity ?? 0;
    if (minQty > 0 && remainingStock <= minQty) {
      triggerWebhook("component.low_stock", {
        componentId,
        componentName: component.name,
        remainingStock,
        minQuantity: minQty,
      }).catch(() => {});
      notifyIntegrations("component.low_stock", {
        componentName: component.name,
        quantity: remainingStock,
        minQuantity: minQty,
      }).catch(() => {});
    }

    return NextResponse.json(checkout, { status: 201 });
  } catch (e: any) {
    logger.error("POST /api/components/checkout error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create component checkout" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
