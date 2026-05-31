import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { validateBody, consumableCheckoutSchema } from "@/lib/validation";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { logger, logCatchError } from "@/lib/logger";

// GET /api/consumable/checkout?consumableId=...
export async function GET(req: Request) {
  try {
    await requirePermission("consumable:view");
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const { searchParams } = new URL(req.url);
    const consumableId = searchParams.get("consumableId");

    const baseWhere = consumableId ? { consumableId } : {};

    // Scope checkouts to consumables owned by the user's organization
    const orgConsumables = await prisma.consumable.findMany({
      where: scopeToOrganization({}, orgId),
      select: { consumableid: true },
    });
    const orgConsumableIds = new Set(orgConsumables.map((c) => c.consumableid));

    const checkouts = await prisma.consumable_checkouts.findMany({
      where: {
        ...baseWhere,
        consumableId: { in: Array.from(orgConsumableIds) },
      },
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
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    // Entire checkout flow in a single transaction: verify, check stock, decrement, create record
    const result = await prisma.$transaction(async (tx) => {
      // Re-read the consumable inside the transaction to get the latest quantity
      const consumable = await tx.consumable.findFirst({
        where: scopeToOrganization({ consumableid: consumableId }, orgId),
      });

      if (!consumable) {
        return {
          error: "not_found" as const,
          consumable: null,
          checkout: null,
        };
      }

      if (consumable.quantity < quantity) {
        return {
          error: "insufficient_stock" as const,
          available: consumable.quantity,
          consumable,
          checkout: null,
        };
      }

      // Atomically decrement the consumable quantity
      await tx.consumable.update({
        where: { consumableid: consumableId },
        data: {
          quantity: {
            decrement: quantity,
          },
        },
      });

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

      return { error: null, consumable, checkout: created };
    });

    if (result.error === "not_found") {
      return NextResponse.json(
        { error: "Consumable not found" },
        { status: 404 },
      );
    }

    if (result.error === "insufficient_stock") {
      return NextResponse.json(
        {
          error: "Insufficient stock",
          available: result.available,
          requested: quantity,
        },
        { status: 400 },
      );
    }

    const { consumable, checkout } = result;

    // Side effects outside the transaction: audit log, webhooks, notifications
    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.CONSUMABLE,
      entityId: checkout!.id,
      details: {
        type: "checkout",
        consumableId,
        userId,
        quantity,
        consumableName: consumable!.consumablename,
      },
    });

    // Check remaining stock after checkout and trigger low/critical stock webhooks
    const remainingStock = consumable!.quantity - quantity;
    const minQty = consumable!.minQuantity ?? 0;
    if (minQty > 0 && remainingStock <= 0) {
      triggerWebhook("consumable.critical_stock", {
        consumableId,
        consumableName: consumable!.consumablename,
        remainingStock,
        minQuantity: minQty,
      }).catch(() => {});
      notifyIntegrations("consumable.critical_stock", {
        consumableName: consumable!.consumablename,
        quantity: remainingStock,
        minQuantity: minQty,
      }).catch(logCatchError("Integration notification failed"));
    } else if (minQty > 0 && remainingStock <= minQty) {
      triggerWebhook("consumable.low_stock", {
        consumableId,
        consumableName: consumable!.consumablename,
        remainingStock,
        minQuantity: minQty,
      }).catch(() => {});
      notifyIntegrations("consumable.low_stock", {
        consumableName: consumable!.consumablename,
        quantity: remainingStock,
        minQuantity: minQty,
      }).catch(logCatchError("Integration notification failed"));
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
