import { NextResponse } from "next/server";
import { cleanExpiredSessions } from "@/lib/session-tracking";

/**
 * Cron endpoint for cleaning up expired sessions.
 * Secured by CRON_SECRET header (for external cron services like Vercel Cron).
 *
 * Usage: GET /api/cron/sessions
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cleanedCount = await cleanExpiredSessions();

    return NextResponse.json(
      {
        success: true,
        cleanedSessions: cleanedCount,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Cron session cleanup error:", error);
    return NextResponse.json(
      { error: "Failed to clean up sessions" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
