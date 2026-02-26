import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";
import { logger } from "@/lib/logger";

// GET /api/licence/seats/[id]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission("license:view");

    const { id } = await params;

    const assignment = await prisma.licenceSeatAssignment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            userid: true,
            firstname: true,
            lastname: true,
            email: true,
          },
        },
        assignedByUser: {
          select: {
            userid: true,
            firstname: true,
            lastname: true,
            email: true,
          },
        },
        licence: {
          select: {
            licenceid: true,
            licencekey: true,
            seatCount: true,
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Seat assignment not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(assignment, { status: 200 });
  } catch (e: any) {
    logger.error("GET /api/licence/seats/[id] error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to fetch seat assignment" },
      { status: 500 },
    );
  }
}

// DELETE /api/licence/seats/[id] — Unassign seat (soft-delete)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const admin = await requirePermission("license:assign");

    const { id } = await params;

    // Fetch the existing assignment
    const existing = await prisma.licenceSeatAssignment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            userid: true,
            firstname: true,
            lastname: true,
          },
        },
        licence: {
          select: {
            licenceid: true,
            licencekey: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Seat assignment not found" },
        { status: 404 },
      );
    }

    if (existing.unassignedAt) {
      return NextResponse.json(
        { error: "Seat assignment is already unassigned" },
        { status: 400 },
      );
    }

    // Soft-delete: set unassignedAt
    const updated = await prisma.licenceSeatAssignment.update({
      where: { id },
      data: {
        unassignedAt: new Date(),
      },
    });

    // Audit log
    await createAuditLog({
      userId: admin.id ?? null,
      action: AUDIT_ACTIONS.UNASSIGN,
      entity: AUDIT_ENTITIES.LICENCE_SEAT,
      entityId: id,
      details: {
        licenceId: existing.licenceId,
        userId: existing.userId,
        seatNumber: existing.seatNumber,
      },
    });

    const userName = `${existing.user.firstname ?? ""} ${existing.user.lastname ?? ""}`.trim();

    // Webhook
    triggerWebhook("license.seat_unassigned", {
      assignmentId: id,
      licenceId: existing.licenceId,
      userId: existing.userId,
      seatNumber: existing.seatNumber,
      userName,
      licenceName: existing.licence.licencekey,
    }).catch(() => {});

    // Slack/Teams notifications
    notifyIntegrations("license.seat_unassigned", {
      assignmentId: id,
      licenceId: existing.licenceId,
      userId: existing.userId,
      seatNumber: existing.seatNumber,
      userName,
      licenceName: existing.licence.licencekey,
    }).catch(() => {});

    return NextResponse.json(updated, { status: 200 });
  } catch (e: any) {
    logger.error("DELETE /api/licence/seats/[id] error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Seat assignment not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to unassign licence seat" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
