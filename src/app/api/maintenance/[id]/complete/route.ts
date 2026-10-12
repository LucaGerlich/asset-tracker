import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireApiAuth,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { queueEmail } from "@/lib/email/service";
import {
  emailTemplates,
  renderTemplate,
  renderTextTemplate,
} from "@/lib/email/templates";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Advance a date based on maintenance frequency.
 * daily -> +1 day, weekly -> +7 days, monthly -> +1 month,
 * quarterly -> +3 months, annually -> +1 year
 */
function advanceDate(date: Date, frequency: string): Date {
  const next = new Date(date);
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      break;
    case "annually":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      // Fallback: advance by 30 days
      next.setDate(next.getDate() + 30);
      break;
  }
  return next;
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
    const newNextDueDate = advanceDate(
      schedule.nextDueDate,
      schedule.frequency,
    );

    const [log, updatedSchedule] = await prisma.$transaction([
      prisma.maintenance_logs.create({
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
      }),
      prisma.maintenance_schedules.update({
        where: { id },
        data: {
          lastCompletedAt: now,
          nextDueDate: newNextDueDate,
          updatedAt: now,
        },
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
      }),
    ]);

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
