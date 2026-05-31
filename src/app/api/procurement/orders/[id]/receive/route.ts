import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requirePermission,
  requireNotDemoMode,
  requirePlanFeature,
} from "@/lib/api-auth";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { logger } from "@/lib/logger";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const receiveItemSchema = z.object({
  itemId: z.string().uuid(),
  receivedQty: z.number().int().min(1),
  condition: z.string().min(1).max(50),
});

const receiveGoodsSchema = z.object({
  notes: z.string().optional(),
  items: z.array(receiveItemSchema).min(1),
});

// POST /api/procurement/orders/[id]/receive - Record goods receipt
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const { id } = await params;
    const user = await requirePermission("procurement:receive");
    await requirePlanFeature(user, "procurement");

    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization context required" },
        { status: 400 },
      );
    }

    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: scopeToOrganization({ id }, orgId),
      include: {
        purchaseRequest: {
          include: { items: true },
        },
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 },
      );
    }

    if (purchaseOrder.status === "received") {
      return NextResponse.json(
        { error: "This purchase order has already been fully received" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const validated = receiveGoodsSchema.parse(body);

    // Validate that all item IDs belong to the linked purchase request
    const requestItems = purchaseOrder.purchaseRequest?.items ?? [];
    const requestItemIds = new Set(requestItems.map((item) => item.id));

    for (const receiveItem of validated.items) {
      if (!requestItemIds.has(receiveItem.itemId)) {
        return NextResponse.json(
          {
            error: `Item ${receiveItem.itemId} does not belong to this purchase order's request`,
          },
          { status: 400 },
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const goodsReceipt = await tx.goodsReceipt.create({
        data: {
          purchaseOrderId: id,
          receivedBy: user.id!,
          notes: validated.notes ?? null,
          items: validated.items.map((item) => ({
            itemId: item.itemId,
            receivedQty: item.receivedQty,
            condition: item.condition,
          })),
        },
      });

      for (const receiveItem of validated.items) {
        await tx.purchaseRequestItem.update({
          where: { id: receiveItem.itemId },
          data: {
            receivedQuantity: {
              increment: receiveItem.receivedQty,
            },
          },
        });
      }

      const updatedItems = await tx.purchaseRequestItem.findMany({
        where: {
          purchaseRequestId: purchaseOrder.purchaseRequestId!,
        },
      });

      const allFullyReceived = updatedItems.every(
        (item) => item.receivedQuantity >= item.quantity,
      );

      const newStatus = allFullyReceived ? "received" : "partially_received";

      await tx.purchaseOrder.update({
        where: { id },
        data: { status: newStatus },
      });

      // Auto-create assets for items with entityType === 'asset'
      const createdAssets = [];
      const timestamp = Date.now();

      for (const receiveItem of validated.items) {
        const requestItem = requestItems.find(
          (ri) => ri.id === receiveItem.itemId,
        );
        if (!requestItem || requestItem.entityType !== "asset") continue;

        for (let i = 0; i < receiveItem.receivedQty; i++) {
          const assetTag = `AUTO-${timestamp}-${createdAssets.length + 1}`;
          const asset = await tx.asset.create({
            data: {
              assetname: requestItem.description,
              assettag: assetTag,
              serialnumber: `${assetTag}-SN`,
              purchaseprice: requestItem.estimatedUnitCost,
              purchasedate: new Date(),
              organizationId: orgId,
              creation_date: new Date(),
            },
          });
          createdAssets.push(asset);
        }
      }

      return { goodsReceipt, newStatus, createdAssets };
    });

    // Audit log for goods receipt
    await createAuditLog({
      userId: user.id!,
      action: "RECEIVE_GOODS",
      entity: "goods_receipt",
      entityId: result.goodsReceipt.id,
      details: {
        purchaseOrderId: id,
        poNumber: purchaseOrder.poNumber,
        itemCount: validated.items.length,
        newPoStatus: result.newStatus,
      },
    });

    // Audit log for each auto-created asset
    for (const asset of result.createdAssets) {
      await createAuditLog({
        userId: user.id!,
        action: AUDIT_ACTIONS.CREATE,
        entity: "asset",
        entityId: asset.assetid,
        details: {
          assetname: asset.assetname,
          assettag: asset.assettag,
          source: "procurement_auto_create",
          purchaseOrderId: id,
          goodsReceiptId: result.goodsReceipt.id,
        },
      });
    }

    return NextResponse.json(
      {
        goodsReceipt: result.goodsReceipt,
        purchaseOrderStatus: result.newStatus,
        createdAssets: result.createdAssets,
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error("POST /api/procurement/orders/[id]/receive error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to record goods receipt" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
