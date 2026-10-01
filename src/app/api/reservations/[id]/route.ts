import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, requireNotDemoMode } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { updateReservationSchema } from "@/lib/validation-organization";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { triggerWebhook } from "@/lib/webhooks";
import { z } from "zod";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Map auth errors to their HTTP status; everything else is a 500. */
function handleReservationError(
  error: unknown,
  fallbackMessage: string,
): NextResponse {
  const message = error instanceof Error ? error.message : "";
  if (message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (message.startsWith("Forbidden")) {
    return NextResponse.json({ error: message }, { status: 403 });
  }
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

    // Only admin can approve/reject, but users can cancel their own
    const isOwner = existingReservation.userId === user.id;
    const isAdmin = user.isAdmin;

    if (validated.status === "approved" || validated.status === "rejected") {
      if (!isAdmin) {
        return NextResponse.json(
          { error: "Only admins can approve or reject reservations" },
          { status: 403 },
        );
      }
    } else if (validated.status === "cancelled") {
      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const updateData: {
      status?: string;
      notes?: string | null;
      approvedBy?: string;
      approvedAt?: Date;
    } = {
      ...validated,
    };

    // Set approval info if approving/rejecting
    if (validated.status === "approved" || validated.status === "rejected") {
      updateData.approvedBy = user.id!;
      updateData.approvedAt = new Date();
    }

    const reservation = await prisma.assetReservation.update({
      where: { id },
      data: updateData,
      include: {
        asset: { select: { assetname: true, assettag: true } },
        user: { select: { firstname: true, lastname: true } },
      },
    });

    const action =
      validated.status === "approved"
        ? AUDIT_ACTIONS.APPROVE
        : validated.status === "rejected"
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
    if (validated.status === "approved") {
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
