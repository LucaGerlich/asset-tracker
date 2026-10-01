import { NextResponse } from "next/server";
import { isValidCronAuth } from "@/lib/cron-auth";
import { processAccessExpiry } from "@/lib/access-expiry";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!isValidCronAuth(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processAccessExpiry();

    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Cron access-expiry error", { error });
    return NextResponse.json(
      { error: "Failed to process access expiry" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
