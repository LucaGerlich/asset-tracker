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

// POST /api/procurement/requests/[id]/submit - Submit a draft request for approval
export async function POST(req: NextRequest, { params }: RouteParams) {
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
      include: { _count: { select: { items: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Purchase request not found" },
        { status: 404 },
      );
    }

    if (existing.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft requests can be submitted for approval" },
        { status: 400 },
      );
    }

    // Only the requester can submit
    if (existing.requesterId !== user.id) {
      return NextResponse.json(
        { error: "Only the requester can submit this request" },
        { status: 403 },
      );
    }

    if (existing._count.items === 0) {
      return NextResponse.json(
        { error: "Cannot submit a request with no items" },
        { status: 400 },
      );
    }

    const updatedRequest = await prisma.purchaseRequest.update({
      where: { id },
      data: { status: "pending_approval" },
      include: {
        requester: {
          select: {
            userid: true,
            firstname: true,
            lastname: true,
            email: true,
          },
        },
        _count: { select: { items: true } },
      },
    });

    await createAuditLog({
      userId: user.id!,
      action: "SUBMIT",
      entity: "purchase_request",
      entityId: id,
      details: {
        title: existing.title,
      },
    });

    return NextResponse.json(updatedRequest);
  } catch (error) {
    logger.error("POST /api/procurement/requests/[id]/submit error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to submit purchase request" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
