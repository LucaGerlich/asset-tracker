import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";

const NOTIFICATION_SORT_FIELDS = ["createdAt", "type", "status"];

// GET /api/notifications - Fetch notifications for the current user
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status'); // 'pending', 'sent', 'all'

        const where: Record<string, unknown> = {
            userId: session.user.id,
        };

        if (status && status !== 'all') {
            where.status = status;
        }

        const unreadCount = await prisma.notification_queue.count({
            where: {
                userId: session.user.id,
                status: 'pending',
            },
        });

        // If no `page` param, return all results for backward compatibility
        if (!searchParams.has("page")) {
            const limit = parseInt(searchParams.get('limit') || '20');

            const notifications = await prisma.notification_queue.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
            });

            const total = await prisma.notification_queue.count({
                where,
            });

            return NextResponse.json({
                notifications,
                total,
                unreadCount,
            });
        }

        // Paginated path
        const params = parsePaginationParams(searchParams);
        const prismaArgs = buildPrismaArgs(params, NOTIFICATION_SORT_FIELDS);

        // Search filter
        if (params.search) {
            where.OR = [
                { subject: { contains: params.search, mode: "insensitive" } },
                { body: { contains: params.search, mode: "insensitive" } },
            ];
        }

        const [notifications, total] = await Promise.all([
            prisma.notification_queue.findMany({ where, ...prismaArgs }),
            prisma.notification_queue.count({ where }),
        ]);

        return NextResponse.json({
            ...buildPaginatedResponse(notifications, total, params),
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
