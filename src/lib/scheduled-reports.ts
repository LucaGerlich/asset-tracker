/**
 * Scheduled Reports Processing
 *
 * Processes due report schedules: generates reports, queues emails
 * with attachments, and updates the next run time.
 */

import prisma from "@/lib/prisma";
import { queueEmail } from "@/lib/email";
import {
  renderTemplate,
  renderTextTemplate,
  emailTemplates,
} from "@/lib/email/templates";
import { generateReportBuffer, type ReportType } from "@/lib/report-generator";
import { logger } from "@/lib/logger";

interface ProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
}

export async function processScheduledReports(): Promise<ProcessResult> {
  const now = new Date();

  const dueSchedules = await prisma.reportSchedule.findMany({
    where: {
      isActive: true,
      nextRunAt: { lte: now },
    },
    include: {
      user: {
        select: {
          userid: true,
          firstname: true,
          lastname: true,
          email: true,
          isActive: true,
        },
      },
    },
  });

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const schedule of dueSchedules) {
    processed++;

    // Skip if user is inactive or has no email
    if (!schedule.user.isActive || !schedule.user.email) {
      await updateNextRun(schedule.id, schedule.frequency, now);
      continue;
    }

    try {
      const reportBuffer = await generateReportBuffer(
        schedule.reportType as ReportType,
        schedule.format as "csv" | "xlsx",
        schedule.organizationId,
      );

      const reportTypeLabel =
        schedule.reportType.charAt(0).toUpperCase() +
        schedule.reportType.slice(1);

      const html = renderTemplate(emailTemplates.scheduledReport.html, {
        userName: `${schedule.user.firstname} ${schedule.user.lastname}`,
        reportType: reportTypeLabel,
        format: schedule.format.toUpperCase(),
        generatedAt: now.toLocaleString(),
      });

      const subject = renderTextTemplate(
        emailTemplates.scheduledReport.subject,
        {
          reportType: reportTypeLabel,
        },
      );

      // Embed the report as a base64 data URI link in the email body
      const base64Data = reportBuffer.buffer.toString("base64");
      const dataUri = `data:${reportBuffer.mimeType};base64,${base64Data}`;
      const downloadHtml = `${html}<p style="margin-top: 20px;"><a href="${dataUri}" download="${reportBuffer.filename}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">Download ${reportBuffer.filename}</a></p>`;

      await queueEmail(
        schedule.user.userid,
        "scheduled_report",
        schedule.user.email,
        subject,
        downloadHtml,
      );

      await prisma.reportSchedule.update({
        where: { id: schedule.id },
        data: {
          lastSentAt: now,
          nextRunAt: computeNextRunAt(schedule.frequency, now),
        },
      });

      succeeded++;
    } catch (error) {
      logger.error("Failed to process scheduled report", {
        scheduleId: schedule.id,
        reportType: schedule.reportType,
        error,
      });
      // Still advance nextRunAt to avoid retrying the same failure forever
      await updateNextRun(schedule.id, schedule.frequency, now);
      failed++;
    }
  }

  if (processed > 0) {
    logger.info("Scheduled reports processing complete", {
      processed,
      succeeded,
      failed,
    });
  }

  return { processed, succeeded, failed };
}

async function updateNextRun(
  scheduleId: string,
  frequency: string,
  fromDate: Date,
): Promise<void> {
  await prisma.reportSchedule.update({
    where: { id: scheduleId },
    data: { nextRunAt: computeNextRunAt(frequency, fromDate) },
  });
}

export function computeNextRunAt(frequency: string, fromDate: Date): Date {
  const next = new Date(fromDate);
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
    default:
      next.setDate(next.getDate() + 7); // fallback to weekly
  }
  return next;
}
