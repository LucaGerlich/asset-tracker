import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { hasPermission } from "@/lib/rbac";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { validateBody, createApprovalSchema } from "@/lib/validation";
import { logger } from "@/lib/logger";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";

const APPROVAL_SORT_FIELDS = ["status", "createdAt"];

// GET /api/approvals - List approval requests
export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("reservation:view");

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status");
    const requesterId = searchParams.get("requesterId");

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (requesterId) where.requesterId = requesterId;

    // Non-admin users without reservation:approve can only see their own approval requests
    const canApprove =
      user.isAdmin ||
      (user.id ? await hasPermission(user.id, "reservation:approve") : false);
    if (!canApprove) {
      where.requesterId = user.id!;
    }

    const include = {
      requester: {
        select: { userid: true, firstname: true, lastname: true, email: true },
      },
      approver: {
        select: { userid: true, firstname: true, lastname: true, email: true },
      },
    };

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const approvals = await prisma.approvalRequest.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(approvals);
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, APPROVAL_SORT_FIELDS);

    const [approvals, total] = await Promise.all([
      prisma.approvalRequest.findMany({ where, include, ...prismaArgs }),
      prisma.approvalRequest.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedResponse(approvals, total, params), {
      status: 200,
    });
  } catch (e: unknown) {
    const error = e as Error;
    logger.error("GET /api/approvals error", { error });

    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to fetch approvals" },
      { status: 500 },
    );
  }
}

// POST /api/approvals - Create a new approval request
export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requirePermission("reservation:create");

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
      action: AUDIT_ACTIONS.REQUEST,
      entity: "ApprovalRequest",
      entityId: approval.id,
      details: { entityType, entityId },
    });

    return NextResponse.json(approval, { status: 201 });
  } catch (e: unknown) {
    const error = e as Error;
    logger.error("POST /api/approvals error", { error });

    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to create approval request" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
