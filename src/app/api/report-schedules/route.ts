import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { getOrganizationContext } from "@/lib/organization-context";
import { createReportScheduleSchema } from "@/lib/validation";
import { computeNextRunAt } from "@/lib/scheduled-reports";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const userId = orgCtx?.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const schedules = await prisma.reportSchedule.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(schedules);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("GET /api/report-schedules error", { error });
    return NextResponse.json(
      { error: "Failed to fetch report schedules" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const userId = orgCtx?.userId;
    const orgId = orgCtx?.organization?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validation = createReportScheduleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.issues },
        { status: 400 },
      );
    }

    const { reportType, frequency, format } = validation.data;

    // Prevent duplicate subscriptions
    const existing = await prisma.reportSchedule.findFirst({
      where: { userId, reportType, isActive: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: "You already have an active subscription for this report type",
        },
        { status: 409 },
      );
    }

    const schedule = await prisma.reportSchedule.create({
      data: {
        userId,
        organizationId: orgId ?? null,
        reportType,
        frequency,
        format,
        nextRunAt: computeNextRunAt(frequency, new Date()),
      },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("POST /api/report-schedules error", { error });
    return NextResponse.json(
      { error: "Failed to create report schedule" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const userId = orgCtx?.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, isActive, frequency, format } = body as {
      id: string;
      isActive?: boolean;
      frequency?: string;
      format?: string;
    };

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    // Ensure the schedule belongs to the user
    const existing = await prisma.reportSchedule.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (frequency) {
      updateData.frequency = frequency;
      updateData.nextRunAt = computeNextRunAt(frequency, new Date());
    }
    if (format) updateData.format = format;

    const updated = await prisma.reportSchedule.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("PUT /api/report-schedules error", { error });
    return NextResponse.json(
      { error: "Failed to update report schedule" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const userId = orgCtx?.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    // Ensure the schedule belongs to the user
    const existing = await prisma.reportSchedule.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.reportSchedule.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("DELETE /api/report-schedules error", { error });
    return NextResponse.json(
      { error: "Failed to delete report schedule" },
      { status: 500 },
    );
  }
}
