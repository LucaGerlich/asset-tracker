import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

// GET /api/health — public liveness probe (no sensitive info)
export async function GET() {
  const startTime = Date.now();

  try {
    // Check database connection
    let dbHealthy = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbHealthy = true;
    } catch (error) {
      logger.error("Health check: Database connection failed", { error });
    }

    const isHealthy = dbHealthy;

    return NextResponse.json(
      {
        status: isHealthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: dbHealthy ? "healthy" : "unhealthy" },
        },
        responseTime: Date.now() - startTime,
      },
      { status: isHealthy ? 200 : 503 },
    );
  } catch (error) {
    logger.error("Health check failed", { error });
    return NextResponse.json(
      { status: "unhealthy", timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}

export const dynamic = "force-dynamic";
