import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/api-auth";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";

const AUDIT_LOG_SORT_FIELDS = [
  "createdAt",
  "action",
  "entity",
  "entityId",
  "userId",
];

// GET /api/admin/audit-logs
export async function GET(req: Request) {
  try {
    await requirePermission('audit:view');

    const { searchParams } = new URL(req.url);
    const params = parsePaginationParams(searchParams);

    // Default sort by createdAt desc if none specified
    if (!params.sortBy) {
      params.sortBy = "createdAt";
      params.sortOrder = "desc";
    }

    const prismaArgs = buildPrismaArgs(params, AUDIT_LOG_SORT_FIELDS);

    // Build where clause from filters
    const where: Record<string, unknown> = {};

    const userId = searchParams.get("userId");
    if (userId) {
      where.userId = userId;
    }

    const entity = searchParams.get("entity");
    if (entity) {
      where.entity = entity;
    }

    const action = searchParams.get("action");
    if (action) {
      where.action = action;
    }

    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {};
      if (dateFrom) {
        createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Include the entire end day
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        createdAt.lte = endDate;
      }
      where.createdAt = createdAt;
    }

    // Search across entity, entityId, details, and user names
    if (params.search) {
      where.OR = [
        { entity: { contains: params.search, mode: "insensitive" } },
        { entityId: { contains: params.search, mode: "insensitive" } },
        { details: { contains: params.search, mode: "insensitive" } },
        { action: { contains: params.search, mode: "insensitive" } },
        {
          user: {
            OR: [
              { firstname: { contains: params.search, mode: "insensitive" } },
              { lastname: { contains: params.search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.audit_logs.findMany({
        where,
        ...prismaArgs,
        include: {
          user: {
            select: {
              userid: true,
              firstname: true,
              lastname: true,
            },
          },
        },
      }),
      prisma.audit_logs.count({ where }),
    ]);

    return NextResponse.json(
      buildPaginatedResponse(logs, total, params),
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /api/admin/audit-logs error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
