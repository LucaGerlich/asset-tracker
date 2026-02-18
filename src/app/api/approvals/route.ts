import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { validateBody, createApprovalSchema } from "@/lib/validations";

// GET /api/approvals - List approval requests
export async function GET(req: NextRequest) {
  try {
    const user = await requireApiAuth();

    const status = req.nextUrl.searchParams.get("status");
    const requesterId = req.nextUrl.searchParams.get("requesterId");

    const where: {
      status?: string;
      requesterId?: string;
    } = {};

    if (status) where.status = status;
    if (requesterId) where.requesterId = requesterId;

    // Non-admin users can only see their own approval requests
    if (!user.isAdmin) {
      where.requesterId = user.id!;
    }

    const approvals = await prisma.approvalRequest.findMany({
      where,
      include: {
        requester: {
          select: { userid: true, firstname: true, lastname: true, email: true },
        },
        approver: {
          select: { userid: true, firstname: true, lastname: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(approvals);
  } catch (e: unknown) {
    const error = e as Error;
    console.error("GET /api/approvals error:", error);

    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch approvals" },
      { status: 500 }
    );
  }
}

// POST /api/approvals - Create a new approval request
export async function POST(req: NextRequest) {
  try {
    const user = await requireApiAuth();

    const body = await req.json();
    const validated = validateBody(createApprovalSchema, body);
    if (validated instanceof NextResponse) return validated;

    const { entityType, entityId, notes } = validated;

    const approval = await prisma.approvalRequest.create({
      data: {
        entityType,
        entityId,
        requesterId: user.id!,
        notes: notes || null,
        status: "pending",
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

    await createAuditLog({
      userId: user.id!,
      action: AUDIT_ACTIONS.REQUEST,
      entity: "ApprovalRequest",
      entityId: approval.id,
      details: { entityType, entityId },
    });

    return NextResponse.json(approval, { status: 201 });
  } catch (e: unknown) {
    const error = e as Error;
    console.error("POST /api/approvals error:", error);

    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to create approval request" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
