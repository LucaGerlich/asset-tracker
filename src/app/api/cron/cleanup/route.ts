import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

const S = process.env.DB_SCHEMA || "assettool";
if (!/^[a-zA-Z0-9_]+$/.test(S)) {
  throw new Error(
    `Invalid DB_SCHEMA: "${S}". Only alphanumeric and underscores allowed.`,
  );
}

/**
 * Cron endpoint for purging expired cache and rate-limit rows.
 * Secured by CRON_SECRET header (for external cron services like Vercel Cron).
 *
 * Usage: GET /api/cron/cleanup
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deletedCache = await prisma.$executeRawUnsafe(
      `DELETE FROM "${S}"."cache" WHERE "expires_at" <= NOW()`,
    );

    const deletedRateLimits = await prisma.$executeRawUnsafe(
      `DELETE FROM "${S}"."rate_limits" WHERE "reset_at" <= NOW()`,
    );

    logger.info("Cron cleanup completed", { deletedCache, deletedRateLimits });

    return NextResponse.json(
      {
        success: true,
        deletedCache,
        deletedRateLimits,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Cron cleanup error", { error });
    return NextResponse.json(
      { error: "Failed to purge expired rows" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
