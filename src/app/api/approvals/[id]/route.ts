import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth, requireApiAdmin } from "@/lib/api-auth";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { validateBody, resolveApprovalSchema } from "@/lib/validations";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/approvals/[id] - Get a single approval request
export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const user = await requireApiAuth();

    const approval = await prisma.approvalRequest.findUnique({
      where: { id },
      include: {
        requester: {
          select: { userid: true, firstname: true, lastname: true, email: true },
        },
        approver: {
          select: { userid: true, firstname: true, lastname: true, email: true },
        },
      },
    });

    if (!approval) {
      return NextResponse.json({ error: "Approval not found" }, { status: 404 });
    }

    // Non-admin users can only see their own approval requests
    if (!user.isAdmin && approval.requesterId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(approval);
  } catch (e: unknown) {
    const error = e as Error;
    console.error("GET /api/approvals/[id] error:", error);

    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch approval" },
      { status: 500 }
    );
  }
}

// PUT /api/approvals/[id] - Approve or reject an approval request
export async function PUT(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const admin = await requireApiAdmin();

    const body = await req.json();
    const validated = validateBody(resolveApprovalSchema, body);
    if (validated instanceof NextResponse) return validated;

    const { action, notes } = validated;

    const existing = await prisma.approvalRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Approval not found" }, { status: 404 });
    }

    if (existing.status !== "pending") {
      return NextResponse.json(
        { error: "This approval request has already been resolved" },
        { status: 400 }
      );
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    const approval = await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: newStatus,
        approverId: admin.id!,
        resolvedAt: new Date(),
        notes: notes || existing.notes,
      },
      include: {
        requester: {
          select: { userid: true, firstname: true, lastname: true, email: true },
        },
        approver: {
          select: { userid: true, firstname: true, lastname: true, email: true },
        },
      },
    });

    const auditAction = action === "approve" ? AUDIT_ACTIONS.APPROVE : AUDIT_ACTIONS.REJECT;

    await createAuditLog({
      userId: admin.id!,
      action: auditAction,
      entity: "ApprovalRequest",
      entityId: approval.id,
      details: {
        entityType: approval.entityType,
        entityId: approval.entityId,
        status: newStatus,
        notes: notes || null,
      },
    });

    return NextResponse.json(approval);
  } catch (e: unknown) {
    const error = e as Error;
    console.error("PUT /api/approvals/[id] error:", error);

    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to update approval" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
