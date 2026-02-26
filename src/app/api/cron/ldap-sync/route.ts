import { NextResponse } from "next/server";
import { getLdapSettings, syncUsers } from "@/lib/ldap";
import { logger } from "@/lib/logger";

/**
 * Cron endpoint for periodic LDAP user sync.
 * Secured by CRON_SECRET header (for Vercel Cron or external schedulers).
 *
 * Usage: GET /api/cron/ldap-sync
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getLdapSettings();

    if (!settings.enabled || !settings.syncEnabled) {
      return NextResponse.json(
        { success: true, skipped: true, message: "LDAP sync is not enabled" },
        { status: 200 },
      );
    }

    const result = await syncUsers(undefined, "cron");

    return NextResponse.json({
      success: result.success,
      created: result.created,
      updated: result.updated,
      deactivated: result.deactivated,
      errorCount: result.errors.length,
    });
  } catch (error) {
    logger.error("Cron LDAP sync error", { error });
    return NextResponse.json(
      { error: "LDAP sync failed" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
