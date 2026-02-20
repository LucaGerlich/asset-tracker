import { NextResponse } from "next/server";
import { runScheduledWorkflows } from "@/lib/workflow-engine";

/**
 * Cron endpoint for running scheduled workflow checks.
 * Secured by CRON_SECRET header (for external cron services like Vercel Cron).
 *
 * Usage: GET /api/cron/workflows
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await runScheduledWorkflows();
    return NextResponse.json({ success: true, results }, { status: 200 });
  } catch (error) {
    console.error("Cron workflows error:", error);
    return NextResponse.json(
      { error: "Failed to run workflows" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
