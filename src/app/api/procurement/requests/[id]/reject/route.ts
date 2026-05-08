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

// POST /api/procurement/requests/[id]/reject - Reject a purchase request
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
        { error: "Only requests with pending_approval status can be rejected" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const reason = typeof body.reason === "string" ? body.reason : null;

    if (!reason) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 },
      );
    }

    const updatedRequest = await prisma.purchaseRequest.update({
      where: { id },
      data: {
        status: "cancelled",
        notes: existing.notes
          ? `${existing.notes}\n\nRejection reason: ${reason}`
          : `Rejection reason: ${reason}`,
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
      },
    });

    await createAuditLog({
      userId: user.id!,
      action: "REJECT",
      entity: "purchase_request",
      entityId: id,
      details: {
        title: existing.title,
        reason,
      },
    });

    return NextResponse.json(updatedRequest);
  } catch (error) {
    logger.error("POST /api/procurement/requests/[id]/reject error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to reject purchase request" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
