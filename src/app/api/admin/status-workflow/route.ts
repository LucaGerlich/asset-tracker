import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    await requireApiAdmin();

    const transitions = await prisma.status_transitions.findMany({
      include: {
        fromStatus: true,
        toStatus: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(transitions);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("GET /api/admin/status-workflow error", { error });
    return NextResponse.json(
      { error: "Failed to fetch transitions" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const user = await requireApiAdmin();
    await requireWritableOrg(user);

    const { fromStatusId, toStatusId, requiredRole, notifyOnTransition } =
      await req.json();

    if (!fromStatusId || !toStatusId) {
      return NextResponse.json(
        { error: "fromStatusId and toStatusId required" },
        { status: 400 },
      );
    }

    if (fromStatusId === toStatusId) {
      return NextResponse.json(
        { error: "Cannot transition to the same status" },
        { status: 400 },
      );
    }

    const transition = await prisma.status_transitions.create({
      data: {
        fromStatusId,
        toStatusId,
        requiredRole: requiredRole || null,
        notifyOnTransition: notifyOnTransition ?? false,
      },
      include: {
        fromStatus: true,
        toStatus: true,
      },
    });

    return NextResponse.json(transition, { status: 201 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "This transition already exists" },
        { status: 409 },
      );
    }
    logger.error("POST /api/admin/status-workflow error", { error });
    return NextResponse.json(
      { error: "Failed to create transition" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const user = await requireApiAdmin();
    await requireWritableOrg(user);

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await prisma.status_transitions.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("DELETE /api/admin/status-workflow error", { error });
    return NextResponse.json(
      { error: "Failed to delete transition" },
      { status: 500 },
    );
  }
}
