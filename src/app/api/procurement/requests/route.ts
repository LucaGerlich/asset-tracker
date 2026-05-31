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
import { hasPermission } from "@/lib/rbac";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { logger } from "@/lib/logger";
import { z } from "zod";

const REQUEST_SORT_FIELDS = [
  "title",
  "status",
  "priority",
  "createdAt",
  "estimatedTotal",
];

const purchaseRequestItemSchema = z.object({
  entityType: z.string().max(30).default("other"),
  description: z.string().min(1).max(500),
  quantity: z.number().int().min(1).default(1),
  estimatedUnitCost: z.number().min(0).optional(),
  supplierId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const createPurchaseRequestSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  priority: z.string().max(20).default("medium"),
  departmentId: z.string().uuid().optional(),
  notes: z.string().optional(),
  items: z.array(purchaseRequestItemSchema).min(1),
});

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

    // Non-admin users see only their own requests
    const canViewAll =
      user.isAdmin ||
      (user.id ? await hasPermission(user.id, "procurement:approve") : false);
    if (!canViewAll) {
      where.requesterId = user.id!;
    }

    const include = {
      requester: {
        select: { userid: true, firstname: true, lastname: true, email: true },
      },
      _count: {
        select: { items: true },
      },
    };

    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, REQUEST_SORT_FIELDS);

    if (params.search) {
      where.OR = [{ title: { contains: params.search, mode: "insensitive" } }];
    }

    const [requests, total] = await Promise.all([
      prisma.purchaseRequest.findMany({
        where,
        include,
        ...prismaArgs,
        orderBy: prismaArgs.orderBy ?? { createdAt: "desc" },
      }),
      prisma.purchaseRequest.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedResponse(requests, total, params), {
      status: 200,
    });
  } catch (error) {
    logger.error("GET /api/procurement/requests error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch purchase requests" },
      { status: 500 },
    );
  }
}

// POST /api/procurement/requests - Create a new purchase request
export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requirePermission("procurement:create");
    await requirePlanFeature(user, "procurement");

    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization context required" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const validated = createPurchaseRequestSchema.parse(body);

    // Calculate estimated total from items
    const estimatedTotal = validated.items.reduce((sum, item) => {
      if (item.estimatedUnitCost != null) {
        return sum + item.quantity * item.estimatedUnitCost;
      }
      return sum;
    }, 0);

    const purchaseRequest = await prisma.purchaseRequest.create({
      data: {
        title: validated.title,
        description: validated.description ?? null,
        priority: validated.priority,
        departmentId: validated.departmentId ?? null,
        notes: validated.notes ?? null,
        estimatedTotal,
        status: "draft",
        requesterId: user.id!,
        organizationId: orgId,
        items: {
          create: validated.items.map((item) => ({
            entityType: item.entityType,
            description: item.description,
            quantity: item.quantity,
            estimatedUnitCost: item.estimatedUnitCost ?? null,
            supplierId: item.supplierId ?? null,
            notes: item.notes ?? null,
          })),
        },
      },
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
    });

    await createAuditLog({
      userId: user.id!,
      action: AUDIT_ACTIONS.CREATE,
      entity: "purchase_request",
      entityId: purchaseRequest.id,
      details: {
        title: purchaseRequest.title,
        itemCount: validated.items.length,
        estimatedTotal,
      },
    });

    return NextResponse.json(purchaseRequest, { status: 201 });
  } catch (error) {
    logger.error("POST /api/procurement/requests error", { error });
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
      { error: "Failed to create purchase request" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
