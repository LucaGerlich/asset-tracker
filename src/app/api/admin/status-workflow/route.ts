import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { transitionsOfOrganization } from "@/lib/status-transitions";

export async function GET() {
  try {
    const user = await requireApiAdmin();

    // A user without an organization owns no transitions. Never pass an
    // undefined organizationId to Prisma: it would drop the filter.
    const orgId = user.organizationId;
    if (!orgId) return NextResponse.json([], { status: 200 });

    const transitions = await prisma.status_transitions.findMany({
      where: transitionsOfOrganization(orgId),
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

    const orgId = user.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "An organization is required to manage status transitions" },
        { status: 403 },
      );
    }

    const { fromStatusId, toStatusId, requiredRole, notifyOnTransition } =
      await req.json();

    if (
      typeof fromStatusId !== "string" ||
      typeof toStatusId !== "string" ||
      !fromStatusId ||
      !toStatusId
    ) {
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

    // Both statuses must belong to the caller's organization: a transition is
    // only ever visible to, and enforced for, the organization that owns them.
    const ownStatuses = await prisma.statusType.findMany({
      where: {
        statustypeid: { in: [fromStatusId, toStatusId] },
        organizationId: orgId,
      },
      select: { statustypeid: true },
    });
    if (ownStatuses.length !== 2) {
      return NextResponse.json(
        { error: "Status does not exist" },
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

    const orgId = user.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "Transition not found" },
        { status: 404 },
      );
    }

    const { id } = await req.json();
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    // One scoped statement: a transition of another organization matches
    // nothing, so it is neither deleted nor distinguishable from a missing one.
    const { count } = await prisma.status_transitions.deleteMany({
      where: { id, ...transitionsOfOrganization(orgId) },
    });
    if (count === 0) {
      return NextResponse.json(
        { error: "Transition not found" },
        { status: 404 },
      );
    }

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
