import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth, requireNotDemoMode } from "@/lib/api-auth";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { logger } from "@/lib/logger";

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
    await requireApiAuth();
    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    const searchParams = req.nextUrl.searchParams;
    const assetId = searchParams.get("assetId");

    const where: Record<string, unknown> = {};
    if (assetId) {
      where.assetId = assetId;
    }

    // Scope through the related asset's organizationId
    if (orgId) {
      where.asset = {
        ...((where.asset as Record<string, unknown>) || {}),
        organizationId: orgId,
      };
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
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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

    await requireApiAuth();
    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

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

    // Validate required fields
    if (!title || !assetId || !frequency || !nextDueDate) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: title, assetId, frequency, nextDueDate",
        },
        { status: 400 },
      );
    }

    // Validate frequency value
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

    // Verify asset exists and belongs to user's organization
    const asset = await prisma.asset.findFirst({
      where: scopeToOrganization({ assetid: assetId }, orgId),
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Verify assigned user exists if provided
    if (assignedTo) {
      const user = await prisma.user.findUnique({
        where: { userid: assignedTo },
      });
      if (!user) {
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
    }).catch(() => {});

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error creating maintenance schedule", { error });
    return NextResponse.json(
      { error: "Failed to create maintenance schedule" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
