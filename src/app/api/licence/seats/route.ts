import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { validateBody, assignLicenceSeatSchema } from "@/lib/validations";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";
import { logger } from "@/lib/logger";

// GET /api/licence/seats?licenceId=...
export async function GET(req: Request) {
  try {
    await requirePermission("license:view");

    const { searchParams } = new URL(req.url);
    const licenceId = searchParams.get("licenceId");

    if (!licenceId) {
      return NextResponse.json(
        { error: "licenceId query parameter is required" },
        { status: 400 },
      );
    }

    // Fetch the licence to get seatCount
    const licence = await prisma.licence.findUnique({
      where: { licenceid: licenceId },
      select: { licenceid: true, licencekey: true, seatCount: true },
    });

    if (!licence) {
      return NextResponse.json(
        { error: "Licence not found" },
        { status: 404 },
      );
    }

    // Fetch active seat assignments
    const seats = await prisma.licenceSeatAssignment.findMany({
      where: {
        licenceId,
        unassignedAt: null,
      },
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
      },
      orderBy: { seatNumber: "asc" },
    });

    const assignedSeats = seats.length;

    return NextResponse.json(
      {
        seats,
        totalSeats: licence.seatCount,
        assignedSeats,
        availableSeats: licence.seatCount - assignedSeats,
      },
      { status: 200 },
    );
  } catch (e: any) {
    logger.error("GET /api/licence/seats error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to fetch seat assignments" },
      { status: 500 },
    );
  }
}

// POST /api/licence/seats
export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const admin = await requirePermission("license:assign");

    const body = await req.json();

    // Validate input
    const data = validateBody(assignLicenceSeatSchema, body);
    if (data instanceof NextResponse) return data;

    const { licenceId, userId, notes } = data;

    // Use a transaction to ensure atomicity
    const assignment = await prisma.$transaction(async (tx) => {
      // Fetch the licence
      const licence = await tx.licence.findUnique({
        where: { licenceid: licenceId },
        select: { licenceid: true, licencekey: true, seatCount: true },
      });

      if (!licence) {
        throw new Error("Licence not found");
      }

      // Count active seat assignments
      const activeCount = await tx.licenceSeatAssignment.count({
        where: {
          licenceId,
          unassignedAt: null,
        },
      });

      if (activeCount >= licence.seatCount) {
        throw new Error("No available seats for this licence");
      }

      // Check if user is already assigned to this licence
      const existingAssignment = await tx.licenceSeatAssignment.findFirst({
        where: {
          licenceId,
          userId,
          unassignedAt: null,
        },
      });

      if (existingAssignment) {
        throw new Error("User is already assigned to this licence");
      }

      // Auto-assign next seat number
      const maxSeat = await tx.licenceSeatAssignment.aggregate({
        where: { licenceId },
        _max: { seatNumber: true },
      });

      const nextSeatNumber = (maxSeat._max.seatNumber ?? 0) + 1;

      // Create the assignment
      return tx.licenceSeatAssignment.create({
        data: {
          licenceId,
          userId,
          seatNumber: nextSeatNumber,
          assignedBy: admin.id ?? null,
          notes: notes ?? null,
        },
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
        },
      });
    });

    // Audit log
    await createAuditLog({
      userId: admin.id ?? null,
      action: AUDIT_ACTIONS.ASSIGN,
      entity: AUDIT_ENTITIES.LICENCE_SEAT,
      entityId: assignment.id,
      details: {
        licenceId,
        userId,
        seatNumber: assignment.seatNumber,
      },
    });

    // Webhook
    triggerWebhook("license.seat_assigned", {
      assignmentId: assignment.id,
      licenceId,
      userId,
      seatNumber: assignment.seatNumber,
      userName: `${assignment.user.firstname ?? ""} ${assignment.user.lastname ?? ""}`.trim(),
    }).catch(() => {});

    // Slack/Teams notifications
    notifyIntegrations("license.seat_assigned", {
      assignmentId: assignment.id,
      licenceId,
      userId,
      seatNumber: assignment.seatNumber,
      userName: `${assignment.user.firstname ?? ""} ${assignment.user.lastname ?? ""}`.trim(),
    }).catch(() => {});

    return NextResponse.json(assignment, { status: 201 });
  } catch (e: any) {
    logger.error("POST /api/licence/seats error", { error: e });

    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (
      e.message === "Licence not found" ||
      e.message === "No available seats for this licence" ||
      e.message === "User is already assigned to this licence"
    ) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to assign licence seat" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
