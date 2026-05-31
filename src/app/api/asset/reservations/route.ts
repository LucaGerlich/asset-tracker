import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { requireNotDemoMode } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import {
  notifyReservationRequest,
  notifyReservationDecision,
} from "@/lib/notifications";

// GET: List reservations, optionally filtered by assetId and/or status
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assetId = req.nextUrl.searchParams.get("assetId");
    const status = req.nextUrl.searchParams.get("status");

    const where: { assetId?: string; status?: string } = {};
    if (assetId) {
      where.assetId = assetId;
    }
    if (status) {
      where.status = status;
    }

    const reservations = await prisma.assetReservation.findMany({
      where,
      include: {
        asset: {
          select: { assetid: true, assetname: true, assettag: true },
        },
        user: {
          select: { userid: true, firstname: true, lastname: true },
        },
      },
      orderBy: { startDate: "desc" },
    });

    return NextResponse.json(reservations);
  } catch (error) {
    logger.error("Error fetching reservations", { error });
    return NextResponse.json(
      { error: "Failed to fetch reservations" },
      { status: 500 },
    );
  }
}

// POST: Create a new reservation
export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { assetId, startDate, endDate, notes } = body;

    if (!assetId || !startDate || !endDate) {
      return NextResponse.json(
        { error: "assetId, startDate, and endDate are required" },
        { status: 400 },
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 },
      );
    }

    if (start >= end) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 },
      );
    }

    // Verify asset exists
    const asset = await prisma.asset.findUnique({
      where: { assetid: assetId },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Atomic overlap check + create to prevent race conditions
    const reservation = await prisma.$transaction(async (tx) => {
      const overlapping = await tx.assetReservation.findFirst({
        where: {
          assetId,
          status: { notIn: ["cancelled", "rejected"] },
          OR: [
            {
              startDate: { lte: end },
              endDate: { gte: start },
            },
          ],
        },
      });

      if (overlapping) {
        return null;
      }

      return tx.assetReservation.create({
        data: {
          assetId,
          userId: session.user.id!,
          startDate: start,
          endDate: end,
          notes: notes || null,
          status: "pending",
        },
        include: {
          asset: {
            select: { assetid: true, assetname: true, assettag: true },
          },
          user: {
            select: { userid: true, firstname: true, lastname: true },
          },
        },
      });
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Asset already has a reservation for the selected dates" },
        { status: 409 },
      );
    }

    // Notify admins about the new request (fire-and-forget)
    notifyReservationRequest({
      assetName: reservation.asset.assetname,
      assetTag: reservation.asset.assettag,
      requesterName: `${reservation.user.firstname} ${reservation.user.lastname}`,
      startDate: start.toLocaleDateString(),
      endDate: end.toLocaleDateString(),
      notes: notes || null,
    }).catch((e) =>
      logger.error("Failed to send reservation notification", { error: e }),
    );

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    logger.error("Error creating reservation", { error });
    return NextResponse.json(
      { error: "Failed to create reservation" },
      { status: 500 },
    );
  }
}

// PUT: Update reservation status
export async function PUT(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, status, notes } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "id and status are required" },
        { status: 400 },
      );
    }

    const validStatuses = ["pending", "approved", "rejected", "cancelled"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const existing = await prisma.assetReservation.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 },
      );
    }

    const isAdmin = session.user.isadmin;
    const isOwner = existing.userId === session.user.id;

    // Only admins can approve or reject
    if (status === "approved" || status === "rejected") {
      if (!isAdmin) {
        return NextResponse.json(
          { error: "Only admins can approve or reject reservations" },
          { status: 403 },
        );
      }
    }

    // Only the creator can cancel their own (or admin can cancel any)
    if (status === "cancelled") {
      if (!isOwner && !isAdmin) {
        return NextResponse.json(
          { error: "You can only cancel your own reservations" },
          { status: 403 },
        );
      }
    }

    const updateData: {
      status: string;
      notes?: string | null;
      approvedBy?: string;
      approvedAt?: Date;
    } = { status };

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    // Set approval metadata when approving/rejecting
    if (status === "approved" || status === "rejected") {
      updateData.approvedBy = session.user.id!;
      updateData.approvedAt = new Date();
    }

    // Wrap status update + auto-assign in a transaction to prevent race conditions
    // (e.g. two admins approving different reservations for the same asset)
    const { reservation, autoAssignResult } = await prisma.$transaction(
      async (tx) => {
        // Re-check the reservation status inside the transaction
        const current = await tx.assetReservation.findUnique({
          where: { id },
        });

        if (!current) {
          throw new Error("RESERVATION_NOT_FOUND");
        }

        // If another admin already processed this reservation, fail gracefully
        if (current.status !== "pending" && existing.status === "pending") {
          throw new Error(`ALREADY_PROCESSED:${current.status}`);
        }

        const updatedReservation = await tx.assetReservation.update({
          where: { id },
          data: updateData,
          include: {
            asset: {
              select: { assetid: true, assetname: true, assettag: true },
            },
            user: {
              select: {
                userid: true,
                firstname: true,
                lastname: true,
                email: true,
              },
            },
          },
        });

        let assignResult: "assigned" | "already_assigned" | "skipped" =
          "skipped";

        // Auto-assign the asset to the requesting user on approval
        if (status === "approved") {
          const existingAssignment = await tx.userAssets.findFirst({
            where: { assetid: updatedReservation.asset.assetid },
          });

          if (!existingAssignment) {
            await tx.userAssets.create({
              data: {
                assetid: updatedReservation.asset.assetid,
                userid: updatedReservation.user.userid,
                creation_date: new Date(),
              },
            });

            const activeStatus = await tx.statusType.findFirst({
              where: { statustypename: "Active" },
            });

            if (activeStatus) {
              await tx.asset.update({
                where: { assetid: updatedReservation.asset.assetid },
                data: { statustypeid: activeStatus.statustypeid },
              });
            }

            assignResult = "assigned";
          } else {
            assignResult = "already_assigned";
          }
        }

        return {
          reservation: updatedReservation,
          autoAssignResult: assignResult,
        };
      },
    );

    if (status === "approved") {
      if (autoAssignResult === "assigned") {
        logger.info("Auto-assigned asset to user on reservation approval", {
          assetId: reservation.asset.assetid,
          userId: reservation.user.userid,
        });
      } else if (autoAssignResult === "already_assigned") {
        logger.info("Skipped auto-assign: asset already assigned to a user", {
          assetId: reservation.asset.assetid,
        });
      }
    }

    // Notify the requester about approval/rejection (fire-and-forget)
    if (status === "approved" || status === "rejected") {
      const approverName = session.user.name || session.user.email || "Admin";
      notifyReservationDecision({
        assetName: reservation.asset.assetname,
        assetTag: reservation.asset.assettag,
        userName: `${reservation.user.firstname} ${reservation.user.lastname}`,
        userEmail: reservation.user.email || "",
        userId: reservation.user.userid,
        startDate: new Date(existing.startDate).toLocaleDateString(),
        endDate: new Date(existing.endDate).toLocaleDateString(),
        status,
        approverName,
        notes: notes || null,
      }).catch((e) =>
        logger.error("Failed to send reservation decision notification", {
          error: e,
        }),
      );
    }

    return NextResponse.json(reservation);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "RESERVATION_NOT_FOUND") {
        return NextResponse.json(
          { error: "Reservation not found" },
          { status: 404 },
        );
      }
      if (error.message.startsWith("ALREADY_PROCESSED:")) {
        const currentStatus = error.message.split(":")[1];
        return NextResponse.json(
          {
            error: `Reservation has already been ${currentStatus} by another admin`,
          },
          { status: 409 },
        );
      }
    }
    logger.error("Error updating reservation", { error });
    return NextResponse.json(
      { error: "Failed to update reservation" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
