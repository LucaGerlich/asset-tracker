import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requirePlanFeature } from "@/lib/api-auth";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/procurement/orders/[id] - Get a single purchase order
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await requirePermission("procurement:view");
    await requirePlanFeature(user, "procurement");

    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: scopeToOrganization({ id }, orgId),
      include: {
        supplier: {
          select: {
            supplierid: true,
            suppliername: true,
            email: true,
            phonenumber: true,
            website: true,
          },
        },
        purchaseRequest: {
          include: {
            items: {
              include: {
                supplier: {
                  select: { supplierid: true, suppliername: true },
                },
              },
            },
            requester: {
              select: {
                userid: true,
                firstname: true,
                lastname: true,
                email: true,
              },
            },
          },
        },
        goodsReceipts: {
          include: {
            receiver: {
              select: {
                userid: true,
                firstname: true,
                lastname: true,
                email: true,
              },
            },
          },
          orderBy: { receivedAt: "desc" },
        },
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(purchaseOrder);
  } catch (error) {
    logger.error("GET /api/procurement/orders/[id] error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch purchase order" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
