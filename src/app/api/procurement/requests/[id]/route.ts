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

const updatePurchaseRequestSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  priority: z.string().max(20).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        entityType: z.string().max(30).default("other"),
        description: z.string().min(1).max(500),
        quantity: z.number().int().min(1).default(1),
        estimatedUnitCost: z.number().min(0).optional(),
        supplierId: z.string().uuid().nullable().optional(),
        notes: z.string().optional(),
      }),
    )
    .min(1)
    .optional(),
});

// GET /api/procurement/requests/[id] - Get single purchase request
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await requirePermission("procurement:view");
    await requirePlanFeature(user, "procurement");

    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    const purchaseRequest = await prisma.purchaseRequest.findFirst({
      where: scopeToOrganization({ id }, orgId),
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
        approver: {
          select: {
            userid: true,
            firstname: true,
            lastname: true,
            email: true,
          },
        },
        department: {
          select: { id: true, name: true },
        },
      },
    });

    if (!purchaseRequest) {
      return NextResponse.json(
        { error: "Purchase request not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(purchaseRequest);
  } catch (error) {
    logger.error("GET /api/procurement/requests/[id] error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch purchase request" },
      { status: 500 },
    );
  }
}

// PUT /api/procurement/requests/[id] - Update a draft purchase request
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const { id } = await params;
    const user = await requirePermission("procurement:create");
    await requirePlanFeature(user, "procurement");

    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    const existing = await prisma.purchaseRequest.findFirst({
      where: scopeToOrganization({ id }, orgId),
      include: { items: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Purchase request not found" },
        { status: 404 },
      );
    }

    if (existing.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft requests can be updated" },
        { status: 400 },
      );
    }

    // Only requester or admin can update
    if (existing.requesterId !== user.id && !user.isAdmin) {
      return NextResponse.json(
        { error: "Only the requester or an admin can update this request" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const validated = updatePurchaseRequestSchema.parse(body);

    // Calculate new estimated total if items are provided
    let computedTotal: number | undefined;
    if (validated.items) {
      computedTotal = validated.items.reduce((sum, item) => {
        if (item.estimatedUnitCost != null) {
          return sum + item.quantity * item.estimatedUnitCost;
        }
        return sum;
      }, 0);
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
      // If items are provided, replace all items
      if (validated.items) {
        await tx.purchaseRequestItem.deleteMany({
          where: { purchaseRequestId: id },
        });
        await tx.purchaseRequestItem.createMany({
          data: validated.items.map((item) => ({
            purchaseRequestId: id,
            entityType: item.entityType,
            description: item.description,
            quantity: item.quantity,
            estimatedUnitCost: item.estimatedUnitCost ?? null,
            supplierId: item.supplierId ?? null,
            notes: item.notes ?? null,
          })),
        });
      }

      return tx.purchaseRequest.update({
        where: { id },
        data: {
          ...(validated.title !== undefined && { title: validated.title }),
          ...(validated.description !== undefined && {
            description: validated.description,
          }),
          ...(validated.priority !== undefined && {
            priority: validated.priority,
          }),
          ...(validated.departmentId !== undefined && {
            departmentId: validated.departmentId,
          }),
          ...(validated.notes !== undefined && { notes: validated.notes }),
          ...(computedTotal !== undefined && {
            estimatedTotal: computedTotal,
          }),
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
    });

    await createAuditLog({
      userId: user.id!,
      action: AUDIT_ACTIONS.UPDATE,
      entity: "purchase_request",
      entityId: id,
      details: {
        title: updatedRequest.title,
        updatedFields: Object.keys(validated),
      },
    });

    return NextResponse.json(updatedRequest);
  } catch (error) {
    logger.error("PUT /api/procurement/requests/[id] error", { error });
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
      { error: "Failed to update purchase request" },
      { status: 500 },
    );
  }
}

// DELETE /api/procurement/requests/[id] - Delete a draft purchase request
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const { id } = await params;
    const user = await requirePermission("procurement:create");
    await requirePlanFeature(user, "procurement");

    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    const existing = await prisma.purchaseRequest.findFirst({
      where: scopeToOrganization({ id }, orgId),
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Purchase request not found" },
        { status: 404 },
      );
    }

    if (existing.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft requests can be deleted" },
        { status: 400 },
      );
    }

    // Only requester or admin can delete
    if (existing.requesterId !== user.id && !user.isAdmin) {
      return NextResponse.json(
        { error: "Only the requester or an admin can delete this request" },
        { status: 403 },
      );
    }

    await prisma.purchaseRequest.delete({ where: { id } });

    await createAuditLog({
      userId: user.id!,
      action: AUDIT_ACTIONS.DELETE,
      entity: "purchase_request",
      entityId: id,
      details: { title: existing.title },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("DELETE /api/procurement/requests/[id] error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to delete purchase request" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
