import { NextResponse } from "next/server";
import { isValidCronAuth } from "@/lib/cron-auth";
import { processScheduledReports } from "@/lib/scheduled-reports";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!isValidCronAuth(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processScheduledReports();

    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Cron scheduled-reports error", { error });
    return NextResponse.json(
      { error: "Failed to process scheduled reports" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
