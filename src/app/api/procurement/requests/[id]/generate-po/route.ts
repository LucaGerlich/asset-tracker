import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requirePermission,
  requireNotDemoMode,
  requirePlanFeature,
} from "@/lib/api-auth";
import { createAuditLog } from "@/lib/audit-log";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { generatePONumber } from "@/lib/po-number";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/procurement/requests/[id]/generate-po - Generate purchase order(s) from an approved request
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const { id } = await params;
    const user = await requirePermission("procurement:manage_orders");
    await requirePlanFeature(user, "procurement");

    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization context required" },
        { status: 400 },
      );
    }

    const existing = await prisma.purchaseRequest.findFirst({
      where: scopeToOrganization({ id }, orgId),
      include: {
        items: {
          include: {
            supplier: {
              select: { supplierid: true, suppliername: true },
            },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Purchase request not found" },
        { status: 404 },
      );
    }

    if (existing.status !== "approved") {
      return NextResponse.json(
        { error: "Only approved requests can generate purchase orders" },
        { status: 400 },
      );
    }

    // Group items by supplier (null supplier is a separate group)
    const supplierGroups = new Map<string | null, typeof existing.items>();
    for (const item of existing.items) {
      const key = item.supplierId;
      const group = supplierGroups.get(key) ?? [];
      group.push(item);
      supplierGroups.set(key, group);
    }

    const createdPOs = await prisma.$transaction(async (tx) => {
      const pos = [];

      for (const [supplierId, items] of supplierGroups) {
        const poNumber = await generatePONumber(orgId);

        // Calculate total for this PO
        const totalAmount = items.reduce((sum, item) => {
          if (item.estimatedUnitCost != null) {
            return sum + item.quantity * Number(item.estimatedUnitCost);
          }
          return sum;
        }, 0);

        const po = await tx.purchaseOrder.create({
          data: {
            poNumber,
            purchaseRequestId: id,
            supplierId: supplierId ?? null,
            organizationId: orgId,
            status: "draft",
            totalAmount,
          },
          include: {
            supplier: {
              select: { supplierid: true, suppliername: true },
            },
          },
        });

        pos.push(po);
      }

      // Update request status to ordered
      await tx.purchaseRequest.update({
        where: { id },
        data: { status: "ordered" },
      });

      return pos;
    });

    // Audit log for each created PO
    for (const po of createdPOs) {
      await createAuditLog({
        userId: user.id!,
        action: "GENERATE_PO",
        entity: "purchase_order",
        entityId: po.id,
        details: {
          poNumber: po.poNumber,
          purchaseRequestId: id,
          purchaseRequestTitle: existing.title,
          supplierId: po.supplierId,
        },
      });
    }

    return NextResponse.json(createdPOs, { status: 201 });
  } catch (error) {
    logger.error("POST /api/procurement/requests/[id]/generate-po error", {
      error,
    });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to generate purchase order" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
