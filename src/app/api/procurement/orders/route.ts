import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requirePlanFeature } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { logger } from "@/lib/logger";

const ORDER_SORT_FIELDS = [
  "poNumber",
  "status",
  "totalAmount",
  "createdAt",
  "expectedDeliveryDate",
];

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("procurement:view");
    await requirePlanFeature(user, "procurement");

    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status");

    const where: Record<string, unknown> = scopeToOrganization({}, orgId);

    if (status) {
      where.status = status;
    }

    const include = {
      supplier: {
        select: { supplierid: true, suppliername: true },
      },
      purchaseRequest: {
        select: { id: true, title: true },
      },
    };

    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, ORDER_SORT_FIELDS);

    if (params.search) {
      where.OR = [
        { poNumber: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include,
        ...prismaArgs,
        orderBy: prismaArgs.orderBy ?? { createdAt: "desc" },
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedResponse(orders, total, params), {
      status: 200,
    });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("GET /api/procurement/orders error", { error });
    return NextResponse.json(
      { error: "Failed to fetch purchase orders" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
