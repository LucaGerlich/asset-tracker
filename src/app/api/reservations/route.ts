import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { assetReservationSchema } from '@/lib/validation-organization';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { triggerWebhook } from '@/lib/webhooks';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const assetId = req.nextUrl.searchParams.get('assetId');
    const userId = req.nextUrl.searchParams.get('userId');
    const status = req.nextUrl.searchParams.get('status');

    const where: {
      assetId?: string;
      userId?: string;
      status?: string;
    } = {};

    if (assetId) where.assetId = assetId;
    if (userId) where.userId = userId;
    if (status) where.status = status;

    // Non-admin users can only see their own reservations
    if (!session.user.isAdmin) {
      where.userId = session.user.id!;
    }

    const reservations = await prisma.assetReservation.findMany({
      where,
      include: {
        asset: {
          select: { assetid: true, assetname: true, assettag: true }
        },
        user: {
          select: { userid: true, firstname: true, lastname: true, email: true }
        }
      },
      orderBy: { startDate: 'desc' }
    });

    return NextResponse.json(reservations);
  } catch (error) {
    console.error('Error fetching reservations:', error);
    return NextResponse.json({ error: 'Failed to fetch reservations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validated = assetReservationSchema.parse(body);

    // Verify asset exists and is requestable
    const asset = await prisma.asset.findUnique({
      where: { assetid: validated.assetId },
      include: { organization: true }
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    if (asset.requestable === false) {
      return NextResponse.json({ error: 'Asset is not available for reservation' }, { status: 400 });
    }

    // Check for overlapping reservations
    const startDate = new Date(validated.startDate);
    const endDate = new Date(validated.endDate);

    if (startDate >= endDate) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }

    const overlapping = await prisma.assetReservation.findFirst({
      where: {
        assetId: validated.assetId,
        status: { in: ['pending', 'approved'] },
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate }
          }
        ]
      }
    });

    if (overlapping) {
      return NextResponse.json({ error: 'Asset is already reserved for this time period' }, { status: 400 });
    }

    const reservation = await prisma.assetReservation.create({
      data: {
        assetId: validated.assetId,
        userId: session.user.id!,
        startDate,
        endDate,
        notes: validated.notes,
        status: 'pending',
      },
      include: {
        asset: { select: { assetname: true, assettag: true } },
        user: { select: { firstname: true, lastname: true } }
      }
    });

    await createAuditLog({
      userId: session.user.id!,
      action: AUDIT_ACTIONS.REQUEST,
      entity: 'AssetReservation',
      entityId: reservation.id,
      details: { assetId: validated.assetId, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    });

    // Trigger webhook
    await triggerWebhook('asset.reserved', {
      reservation,
      asset: reservation.asset,
      user: reservation.user,
    }, asset.organizationId);

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    console.error('Error creating reservation:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create reservation' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
