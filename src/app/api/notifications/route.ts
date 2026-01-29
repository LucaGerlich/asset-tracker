import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

// GET /api/notifications - Fetch notifications for the current user
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '20');
        const status = searchParams.get('status'); // 'pending', 'sent', 'all'

        const whereClause: { userId: string; status?: string } = {
            userId: session.user.id,
        };

        if (status && status !== 'all') {
            whereClause.status = status;
        }

        const notifications = await prisma.notification_queue.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: limit,
        });

        const total = await prisma.notification_queue.count({
            where: whereClause,
        });

        const unreadCount = await prisma.notification_queue.count({
            where: {
                userId: session.user.id,
                status: 'pending',
            },
        });

        return NextResponse.json({
            notifications,
            total,
            unreadCount,
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return NextResponse.json(
            { error: 'Failed to fetch notifications' },
            { status: 500 }
        );
    }
}

// DELETE /api/notifications - Delete all notifications for the current user
export async function DELETE(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await prisma.notification_queue.deleteMany({
            where: { userId: session.user.id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting notifications:', error);
        return NextResponse.json(
            { error: 'Failed to delete notifications' },
            { status: 500 }
        );
    }
}
