import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { validateBody, componentCheckoutSchema } from "@/lib/validation";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";
import { logger, logCatchError } from "@/lib/logger";

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

    // Use a transaction to atomically verify stock, decrement, and create checkout
    // The stock check MUST be inside the transaction to prevent race conditions
    const { checkout, component } = await prisma.$transaction(async (tx) => {
      // Verify the component exists and has sufficient stock (inside transaction)
      const comp = await tx.component.findUnique({
        where: { id: componentId },
      });

      if (!comp) {
        throw new Error("COMPONENT_NOT_FOUND");
      }

      if (comp.remainingQuantity < quantity) {
        throw new Error(`INSUFFICIENT_STOCK:${comp.remainingQuantity}`);
      }

      await tx.component.update({
        where: { id: componentId },
        data: {
          remainingQuantity: {
            decrement: quantity,
          },
        },
      });

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

      return { checkout: created, component: comp };
    });

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
    }).catch(logCatchError("Integration notification failed"));

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
      }).catch(logCatchError("Integration notification failed"));
    }

    return NextResponse.json(checkout, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "";
    logger.error("POST /api/components/checkout error", { error: e });

    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message.startsWith("Forbidden")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message === "COMPONENT_NOT_FOUND") {
      return NextResponse.json(
        { error: "Component not found" },
        { status: 404 },
      );
    }
    if (message.startsWith("INSUFFICIENT_STOCK:")) {
      const available = parseInt(message.split(":")[1], 10);
      return NextResponse.json(
        {
          error: "Insufficient stock",
          available,
          requested: 0,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Failed to create component checkout" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
