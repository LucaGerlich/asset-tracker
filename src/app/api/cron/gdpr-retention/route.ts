import { NextResponse } from "next/server";
import { isValidCronAuth } from "@/lib/cron-auth";
import { purgeExpiredAuditLogs } from "@/lib/gdpr-retention";
import { logger } from "@/lib/logger";

/**
 * Cron endpoint for GDPR audit log retention enforcement.
 * Deletes audit logs older than the configured retention period.
 *
 * Usage: GET /api/cron/gdpr-retention
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!isValidCronAuth(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deletedCount = await purgeExpiredAuditLogs();

    return NextResponse.json(
      {
        success: true,
        deletedAuditLogs: deletedCount,
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("GDPR retention cron error", { error });
    return NextResponse.json(
      { error: "Failed to purge audit logs" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
