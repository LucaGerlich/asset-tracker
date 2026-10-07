import { NextRequest, NextResponse } from "next/server";
import {
  requireApiAuth,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import prisma from "@/lib/prisma";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { logger } from "@/lib/logger";

const NOTIFICATION_SORT_FIELDS = ["createdAt", "type", "status"];

// GET /api/notifications - Fetch notifications for the current user
export async function GET(request: NextRequest) {
  try {
    const user = await requireApiAuth();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // 'pending', 'sent', 'all'

    const where: Record<string, unknown> = {
      userId: user.id!,
    };

    if (status && status !== "all") {
      where.status = status;
    }

    const unreadCount = await prisma.notification_queue.count({
      where: {
        userId: user.id!,
        status: "pending",
      },
    });

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      // Clamp to 1..100 with a NaN guard so an absent/garbage/huge limit param
      // can't skip pagination and force an unbounded query.
      const rawLimit = parseInt(searchParams.get("limit") || "20");
      const limit = Math.min(Math.max(rawLimit || 20, 1), 100);

      const notifications = await prisma.notification_queue.findMany({
        where,
        orderBy: { createdAt: "desc" },
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
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error fetching notifications", { error });
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 },
    );
  }
}

// DELETE /api/notifications - Delete all notifications for the current user
export async function DELETE(_request: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAuth();
    await requireWritableOrg(user);

    await prisma.notification_queue.deleteMany({
      where: { userId: user.id! },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error deleting notifications", { error });
    return NextResponse.json(
      { error: "Failed to delete notifications" },
      { status: 500 },
    );
  }
}
