import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireApiAuth,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { advanceDueDate } from "@/lib/maintenance-schedule";
import { queueEmail } from "@/lib/email/service";
import {
  emailTemplates,
  renderTemplate,
  renderTextTemplate,
} from "@/lib/email/templates";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST: Complete a maintenance schedule entry
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAuth();
    await requireWritableOrg(user);

    const { id } = await params;

    // A schedule belongs to the organization of its asset. A caller without an
    // organization owns none; never widen the lookup to every organization.
    const orgId = user.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "Maintenance schedule not found" },
        { status: 404 },
      );
    }

    const schedule = await prisma.maintenance_schedules.findFirst({
      where: { id, asset: { organizationId: orgId } },
    });

    if (!schedule) {
      return NextResponse.json(
        { error: "Maintenance schedule not found" },
        { status: 404 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { notes, actualCost } = body;

    const now = new Date();
    const newNextDueDate = advanceDueDate(
      schedule.nextDueDate,
      schedule.frequency,
      now,
    );

    // Claim the schedule by the due date we just read: a concurrent or repeated
    // completion no longer matches it, so the due date advances only once and
    // no duplicate log is written.
    const completed = await prisma.$transaction(async (tx) => {
      const claimed = await tx.maintenance_schedules.updateMany({
        where: { id, nextDueDate: schedule.nextDueDate },
        data: {
          lastCompletedAt: now,
          nextDueDate: newNextDueDate,
          updatedAt: now,
        },
      });
      if (claimed.count !== 1) return null;

      const createdLog = await tx.maintenance_logs.create({
        data: {
          scheduleId: id,
          completedBy: user.id || null,
          completedAt: now,
          notes: notes || null,
          actualCost: actualCost != null ? actualCost : null,
        },
        include: {
          user: {
            select: { userid: true, firstname: true, lastname: true },
          },
        },
      });
      const updated = await tx.maintenance_schedules.findUniqueOrThrow({
        where: { id },
        include: {
          asset: {
            select: { assetid: true, assetname: true },
          },
          user: {
            select: {
              userid: true,
              firstname: true,
              lastname: true,
              email: true,
              organizationId: true,
            },
          },
        },
      });
      return { log: createdLog, updatedSchedule: updated };
    });

    if (!completed) {
      return NextResponse.json(
        { error: "This schedule was already completed. Please refresh." },
        { status: 409 },
      );
    }
    const { log, updatedSchedule } = completed;

    // Send notification to assigned user about completion and next due date.
    // A legacy schedule may still name an assignee of another organization
    // (assignees were not checked before): never email that user.
    if (
      updatedSchedule.assignedTo &&
      updatedSchedule.user?.email &&
      updatedSchedule.user.organizationId === orgId
    ) {
      const template = emailTemplates.maintenanceCompleted;
      const variables = {
        userName: `${updatedSchedule.user.firstname} ${updatedSchedule.user.lastname}`,
        taskTitle: updatedSchedule.title,
        assetName: updatedSchedule.asset?.assetname || "Unknown Asset",
        completedDate: now.toLocaleDateString(),
        nextDueDate: newNextDueDate.toLocaleDateString(),
      };

      queueEmail(
        updatedSchedule.assignedTo,
        "maintenance_completed",
        updatedSchedule.user.email,
        renderTextTemplate(template.subject, variables),
        renderTemplate(template.html, variables),
      ).catch((err) => {
        logger.error("Failed to queue maintenance completion email", {
          error: err,
        });
      });
    }

    return NextResponse.json(
      {
        log,
        schedule: updatedSchedule,
      },
      { status: 201 },
    );
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error completing maintenance", { error });
    return NextResponse.json(
      { error: "Failed to complete maintenance" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
