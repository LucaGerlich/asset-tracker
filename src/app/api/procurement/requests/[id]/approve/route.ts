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
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/procurement/requests/[id]/approve - Approve a purchase request
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const { id } = await params;
    const user = await requirePermission("procurement:approve");
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

    if (existing.status !== "pending_approval") {
      return NextResponse.json(
        { error: "Only requests with pending_approval status can be approved" },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const notes = typeof body.notes === "string" ? body.notes : undefined;

    const updatedRequest = await prisma.purchaseRequest.update({
      where: { id },
      data: {
        status: "approved",
        approvedBy: user.id!,
        approvedAt: new Date(),
        ...(notes && {
          notes: existing.notes
            ? `${existing.notes}\n\nApproval note: ${notes}`
            : `Approval note: ${notes}`,
        }),
      },
      include: {
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
      },
    });

    await createAuditLog({
      userId: user.id!,
      action: "APPROVE",
      entity: "purchase_request",
      entityId: id,
      details: {
        title: existing.title,
        notes,
      },
    });

    return NextResponse.json(updatedRequest);
  } catch (error) {
    logger.error("POST /api/procurement/requests/[id]/approve error", {
      error,
    });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to approve purchase request" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
