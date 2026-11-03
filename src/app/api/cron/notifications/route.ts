import { NextResponse } from "next/server";
import { isValidCronAuth } from "@/lib/cron-auth";
import { runNotificationChecks } from "@/lib/notifications";
import { processEmailQueue } from "@/lib/email";
import { logger } from "@/lib/logger";

/**
 * Cron endpoint for running notification checks and processing the email queue.
 * Secured by CRON_SECRET header (for external cron services like Vercel Cron).
 *
 * Usage: GET /api/cron/notifications
 * Header: Authorization: Bearer <CRON_SECRET>
 */
// The mail deadline is measured from the start of the request: the whole run
// (checks + mails) must finish inside maxDuration, with headroom for the
// in-flight send and the bookkeeping write after it.
const MAIL_DEADLINE_MS = 45_000;

export async function GET(req: Request) {
  const startedAt = Date.now();
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!isValidCronAuth(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Sequential: mails queued by the checks go out in the same run.
    const notifications = await runNotificationChecks();
    const emailQueue = await processEmailQueue({
      deadline: startedAt + MAIL_DEADLINE_MS,
    });

    return NextResponse.json(
      {
        success: true,
        notifications,
        emailQueue,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Cron notifications error", { error });
    return NextResponse.json(
      { error: "Failed to run notifications" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
