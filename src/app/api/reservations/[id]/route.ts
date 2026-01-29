import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { updateReservationSchema } from '@/lib/validation-organization';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { triggerWebhook } from '@/lib/webhooks';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const reservation = await prisma.assetReservation.findUnique({
      where: { id },
      include: {
        asset: {
          select: { assetid: true, assetname: true, assettag: true, organizationId: true }
        },
        user: {
          select: { userid: true, firstname: true, lastname: true, email: true }
        }
      }
    });

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // Non-admin users can only see their own reservations
    if (!session.user.isAdmin && reservation.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(reservation);
  } catch (error) {
    console.error('Error fetching reservation:', error);
    return NextResponse.json({ error: 'Failed to fetch reservation' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validated = updateReservationSchema.parse(body);

    const existingReservation = await prisma.assetReservation.findUnique({
      where: { id },
      include: {
        asset: { select: { assetname: true, organizationId: true } },
        user: { select: { firstname: true, lastname: true } }
      }
    });

    if (!existingReservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // Only admin can approve/reject, but users can cancel their own
    const isOwner = existingReservation.userId === session.user.id;
    const isAdmin = session.user.isAdmin;

    if (validated.status === 'approved' || validated.status === 'rejected') {
      if (!isAdmin) {
        return NextResponse.json({ error: 'Only admins can approve or reject reservations' }, { status: 403 });
      }
    } else if (validated.status === 'cancelled') {
      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
    if (validated.status === 'approved' || validated.status === 'rejected') {
      updateData.approvedBy = session.user.id!;
      updateData.approvedAt = new Date();
    }

    const reservation = await prisma.assetReservation.update({
      where: { id },
      data: updateData,
      include: {
        asset: { select: { assetname: true, assettag: true } },
        user: { select: { firstname: true, lastname: true } }
      }
    });

    const action = validated.status === 'approved' ? AUDIT_ACTIONS.APPROVE : 
                   validated.status === 'rejected' ? AUDIT_ACTIONS.REJECT : 
                   AUDIT_ACTIONS.UPDATE;

    await createAuditLog({
      userId: session.user.id!,
      action,
      entity: 'AssetReservation',
      entityId: reservation.id,
      details: validated as Record<string, unknown>,
    });

    // Trigger webhook for approvals
    if (validated.status === 'approved') {
      await triggerWebhook('asset.reservation_approved', {
        reservation,
        asset: reservation.asset,
        user: reservation.user,
      }, existingReservation.asset.organizationId);
    }

    return NextResponse.json(reservation);
  } catch (error) {
    console.error('Error updating reservation:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update reservation' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const reservation = await prisma.assetReservation.findUnique({
      where: { id }
    });

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // Only owner or admin can delete
    if (reservation.userId !== session.user.id && !session.user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.assetReservation.delete({
      where: { id }
    });

    await createAuditLog({
      userId: session.user.id!,
      action: AUDIT_ACTIONS.DELETE,
      entity: 'AssetReservation',
      entityId: id,
      details: { assetId: reservation.assetId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting reservation:', error);
    return NextResponse.json({ error: 'Failed to delete reservation' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
