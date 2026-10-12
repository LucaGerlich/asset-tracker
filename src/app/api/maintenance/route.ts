import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireApiAuth,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { logger, logCatchError } from "@/lib/logger";

const MAINTENANCE_SORT_FIELDS = [
  "title",
  "frequency",
  "nextDueDate",
  "status",
  "createdAt",
];

// GET: List all maintenance schedules, optionally filtered by assetId
export async function GET(req: NextRequest) {
  try {
    const user = await requireApiAuth();

    const searchParams = req.nextUrl.searchParams;
    const assetId = searchParams.get("assetId");

    // A caller without an organization owns no schedules. Never drop the
    // filter: it would list every tenant's schedules.
    const orgId = user.organizationId;
    if (!orgId) {
      return searchParams.has("page")
        ? NextResponse.json(
            buildPaginatedResponse([], 0, parsePaginationParams(searchParams)),
          )
        : NextResponse.json([]);
    }

    const where: Record<string, unknown> = {
      // Scope through the related asset's organizationId
      asset: { organizationId: orgId },
    };
    if (assetId) {
      where.assetId = assetId;
    }

    const include = {
      asset: {
        select: { assetid: true, assetname: true },
      },
      user: {
        select: { userid: true, firstname: true, lastname: true },
      },
    };

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const schedules = await prisma.maintenance_schedules.findMany({
        where,
        include,
        orderBy: { nextDueDate: "asc" },
      });
      return NextResponse.json(schedules);
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, MAINTENANCE_SORT_FIELDS);

    // Search filter
    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: "insensitive" } },
        { description: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [schedules, total] = await Promise.all([
      prisma.maintenance_schedules.findMany({ where, include, ...prismaArgs }),
      prisma.maintenance_schedules.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedResponse(schedules, total, params), {
      status: 200,
    });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error fetching maintenance schedules", { error });
    return NextResponse.json(
      { error: "Failed to fetch maintenance schedules" },
      { status: 500 },
    );
  }
}

// POST: Create a new maintenance schedule
export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAuth();
    await requireWritableOrg(user);

    const body = await req.json();

    const {
      title,
      assetId,
      frequency,
      nextDueDate,
      description,
      assignedTo,
      estimatedCost,
      isActive,
    } = body;

    if (!title || !assetId || !frequency || !nextDueDate) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: title, assetId, frequency, nextDueDate",
        },
        { status: 400 },
      );
    }

    const validFrequencies = [
      "daily",
      "weekly",
      "monthly",
      "quarterly",
      "annually",
    ];
    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json(
        {
          error: `Invalid frequency. Must be one of: ${validFrequencies.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // A caller without an organization owns no assets; never drop the filter.
    const orgId = user.organizationId;
    if (!orgId) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Verify asset exists and belongs to user's organization
    const asset = await prisma.asset.findFirst({
      where: { assetid: assetId, organizationId: orgId },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // The assignee is emailed when the schedule is completed: it must be a
    // user of the caller's organization.
    if (assignedTo) {
      const assignee = await prisma.user.findFirst({
        where: { userid: assignedTo, organizationId: orgId },
        select: { userid: true },
      });
      if (!assignee) {
        return NextResponse.json(
          { error: "Assigned user not found" },
          { status: 404 },
        );
      }
    }

    const schedule = await prisma.maintenance_schedules.create({
      data: {
        title,
        assetId,
        frequency,
        nextDueDate: new Date(nextDueDate),
        description: description || null,
        assignedTo: assignedTo || null,
        estimatedCost: estimatedCost != null ? estimatedCost : null,
        isActive: isActive != null ? isActive : true,
        updatedAt: new Date(),
      },
      include: {
        asset: {
          select: { assetid: true, assetname: true },
        },
        user: {
          select: { userid: true, firstname: true, lastname: true },
        },
      },
    });

    triggerWebhook(
      "maintenance.due",
      {
        maintenanceId: schedule.id,
        assetId: schedule.assetId,
        title: schedule.title,
      },
      orgId,
    ).catch(() => {});
    notifyIntegrations("maintenance.due", {
      maintenanceTitle: schedule.title,
      assetName: schedule.asset?.assetname,
    }).catch(logCatchError("Integration notification failed"));

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error creating maintenance schedule", { error });
    return NextResponse.json(
      { error: "Failed to create maintenance schedule" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
