import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

// Returns 200 only when the application is ready to accept traffic
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ready",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    // Unauthenticated probe: the driver's message can carry the database host
    // and user, so it is only logged.
    logger.error("Readiness check failed", { error });
    return NextResponse.json(
      {
        status: "not ready",
        timestamp: new Date().toISOString(),
        error: "Database connection failed",
      },
      { status: 503 },
    );
  }
}

export const dynamic = "force-dynamic";
