import { NextRequest, NextResponse } from "next/server";
import {
  requireApiAuth,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { updateReservationSchema } from "@/lib/validation-organization";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { triggerWebhook } from "@/lib/webhooks";
import { z } from "zod";
import { logger } from "@/lib/logger";

/**
 * Allowed status moves: current status -> targets. Rejected, cancelled and
 * completed reservations are final, so they cannot be re-booked.
 */
const RESERVATION_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ["approved", "rejected", "cancelled"],
  approved: ["cancelled", "completed"],
};

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Map auth errors to their HTTP status; everything else is a 500. */
function handleReservationError(
  error: unknown,
  fallbackMessage: string,
): NextResponse {
  const denied = apiErrorResponse(error);
  if (denied) return denied;
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.issues }, { status: 400 });
  }
  logger.error(fallbackMessage, { error });
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await requireApiAuth();

    const reservation = await prisma.assetReservation.findUnique({
      where: { id },
      include: {
        asset: {
          select: {
            assetid: true,
            assetname: true,
            assettag: true,
            organizationId: true,
          },
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

    // Cross-org protection: treat foreign-org reservations as not found.
    if (
      !reservation ||
      reservation.asset.organizationId !== user.organizationId
    ) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 },
      );
    }

    // Non-admin users can only see their own reservations
    if (!user.isAdmin && reservation.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(reservation);
  } catch (error) {
    return handleReservationError(error, "Failed to fetch reservation");
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const { id } = await params;
    const user = await requireApiAuth();
    await requireWritableOrg(user);

    const body = await req.json();
    const validated = updateReservationSchema.parse(body);

    const existingReservation = await prisma.assetReservation.findUnique({
      where: { id },
      include: {
        asset: { select: { assetname: true, organizationId: true } },
        user: { select: { firstname: true, lastname: true } },
      },
    });

    // Cross-org protection: treat foreign-org reservations as not found.
    if (
      !existingReservation ||
      existingReservation.asset.organizationId !== user.organizationId
    ) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 },
      );
    }

    // Admins manage every reservation of the organization; a member may only
    // touch their own, and the only status they can set is "cancelled".
    const isOwner = existingReservation.userId === user.id;
    const isAdmin = user.isAdmin;

    if (!isAdmin) {
      if (!isOwner) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (validated.status !== undefined && validated.status !== "cancelled") {
        return NextResponse.json(
          { error: "Only admins can change a reservation to this status" },
          { status: 403 },
        );
      }
    }

    // A status equal to the current one is not a transition.
    const nextStatus =
      validated.status !== undefined &&
      validated.status !== existingReservation.status
        ? validated.status
        : undefined;

    if (
      nextStatus !== undefined &&
      !RESERVATION_TRANSITIONS[existingReservation.status]?.includes(nextStatus)
    ) {
      return NextResponse.json(
        {
          error: `A ${existingReservation.status} reservation cannot be set to ${nextStatus}`,
        },
        { status: 409 },
      );
    }

    // Approving books the asset: another active reservation must not overlap.
    if (nextStatus === "approved") {
      const conflicting = await prisma.assetReservation.findFirst({
        where: {
          assetId: existingReservation.assetId,
          id: { not: id },
          status: { in: ["pending", "approved"] },
          startDate: { lte: existingReservation.endDate },
          endDate: { gte: existingReservation.startDate },
        },
        select: { id: true },
      });
      if (conflicting) {
        return NextResponse.json(
          { error: "Asset is already reserved for this time period" },
          { status: 409 },
        );
      }
    }

    const updateData: {
      status?: string;
      notes?: string | null;
      approvedBy?: string;
      approvedAt?: Date;
    } = {
      ...validated,
      status: nextStatus,
    };

    // Set approval info if approving/rejecting
    if (nextStatus === "approved" || nextStatus === "rejected") {
      updateData.approvedBy = user.id!;
      updateData.approvedAt = new Date();
    }

    // Compare-and-set on the status validated above so two concurrent
    // decisions cannot both win.
    const updated = await prisma.assetReservation.updateMany({
      where: { id, status: existingReservation.status },
      data: updateData,
    });
    if (updated.count !== 1) {
      return NextResponse.json(
        {
          error:
            "This reservation was modified by another user. Please refresh and try again.",
        },
        { status: 409 },
      );
    }

    const reservation = await prisma.assetReservation.findUniqueOrThrow({
      where: { id },
      include: {
        asset: { select: { assetname: true, assettag: true } },
        user: { select: { firstname: true, lastname: true } },
      },
    });

    const action =
      nextStatus === "approved"
        ? AUDIT_ACTIONS.APPROVE
        : nextStatus === "rejected"
          ? AUDIT_ACTIONS.REJECT
          : AUDIT_ACTIONS.UPDATE;

    await createAuditLog({
      userId: user.id!,
      action,
      entity: "AssetReservation",
      entityId: reservation.id,
      details: validated as Record<string, unknown>,
    });

    // Trigger webhook for approvals
    if (nextStatus === "approved") {
      await triggerWebhook(
        "asset.reservation_approved",
        {
          reservation,
          asset: reservation.asset,
          user: reservation.user,
        },
        existingReservation.asset.organizationId,
      );
    }

    return NextResponse.json(reservation);
  } catch (error) {
    return handleReservationError(error, "Failed to update reservation");
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const { id } = await params;
    const user = await requireApiAuth();
    await requireWritableOrg(user);

    const reservation = await prisma.assetReservation.findUnique({
      where: { id },
      include: { asset: { select: { organizationId: true } } },
    });

    // Cross-org protection: treat foreign-org reservations as not found.
    if (
      !reservation ||
      reservation.asset.organizationId !== user.organizationId
    ) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 },
      );
    }

    // Only owner or admin can delete
    if (reservation.userId !== user.id && !user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.assetReservation.delete({
      where: { id },
    });

    await createAuditLog({
      userId: user.id!,
      action: AUDIT_ACTIONS.DELETE,
      entity: "AssetReservation",
      entityId: id,
      details: { assetId: reservation.assetId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleReservationError(error, "Failed to delete reservation");
  }
}

export const dynamic = "force-dynamic";
