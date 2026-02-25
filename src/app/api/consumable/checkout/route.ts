import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { validateBody, consumableCheckoutSchema } from "@/lib/validations";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";
import { logger } from "@/lib/logger";

// GET /api/consumable/checkout?consumableId=...
export async function GET(req: Request) {
  try {
    await requirePermission("consumable:view");

    const { searchParams } = new URL(req.url);
    const consumableId = searchParams.get("consumableId");

    const where = consumableId ? { consumableId } : {};

    const checkouts = await prisma.consumable_checkouts.findMany({
      where,
      orderBy: { checkedOutAt: "desc" },
      include: {
        user: {
          select: {
            userid: true,
            firstname: true,
            lastname: true,
          },
        },
      },
    });

    return NextResponse.json(checkouts, { status: 200 });
  } catch (e: any) {
    logger.error("GET /api/consumable/checkout error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to fetch consumable checkouts" },
      { status: 500 },
    );
  }
}

// POST /api/consumable/checkout
export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("consumable:edit");

    const body = await req.json();
    const validated = validateBody(consumableCheckoutSchema, body);
    if (validated instanceof NextResponse) return validated;

    const { consumableId, userId, quantity, notes } = validated;

    // Verify the consumable exists and has sufficient stock
    const consumable = await prisma.consumable.findUnique({
      where: { consumableid: consumableId },
    });

    if (!consumable) {
      return NextResponse.json(
        { error: "Consumable not found" },
        { status: 404 },
      );
    }

    if (consumable.quantity < quantity) {
      return NextResponse.json(
        {
          error: "Insufficient stock",
          available: consumable.quantity,
          requested: quantity,
        },
        { status: 400 },
      );
    }

    // Use a transaction to atomically decrement stock and create checkout
    const checkout = await prisma.$transaction(async (tx) => {
      // Decrement the consumable quantity
      await tx.consumable.update({
        where: { consumableid: consumableId },
        data: {
          quantity: {
            decrement: quantity,
          },
        },
      });

      // Create the checkout record
      const created = await tx.consumable_checkouts.create({
        data: {
          consumableId,
          userId,
          quantity,
          notes: notes || null,
        },
        include: {
          user: {
            select: {
              userid: true,
              firstname: true,
              lastname: true,
            },
          },
        },
      });

      return created;
    });

    // Audit log
    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.CONSUMABLE,
      entityId: checkout.id,
      details: {
        type: "checkout",
        consumableId,
        userId,
        quantity,
        consumableName: consumable.consumablename,
      },
    });

    // Check remaining stock after checkout and trigger low/critical stock webhooks
    const remainingStock = consumable.quantity - quantity;
    const minQty = consumable.minQuantity ?? 0;
    if (minQty > 0 && remainingStock <= 0) {
      triggerWebhook("consumable.critical_stock", {
        consumableId,
        consumableName: consumable.consumablename,
        remainingStock,
        minQuantity: minQty,
      }).catch(() => {});
      notifyIntegrations("consumable.critical_stock", {
        consumableName: consumable.consumablename,
        quantity: remainingStock,
        minQuantity: minQty,
      }).catch(() => {});
    } else if (minQty > 0 && remainingStock <= minQty) {
      triggerWebhook("consumable.low_stock", {
        consumableId,
        consumableName: consumable.consumablename,
        remainingStock,
        minQuantity: minQty,
      }).catch(() => {});
      notifyIntegrations("consumable.low_stock", {
        consumableName: consumable.consumablename,
        quantity: remainingStock,
        minQuantity: minQty,
      }).catch(() => {});
    }

    return NextResponse.json(checkout, { status: 201 });
  } catch (e: any) {
    logger.error("POST /api/consumable/checkout error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create consumable checkout" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
