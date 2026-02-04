import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/health/ready - Readiness probe
// Returns 200 only when the application is ready to accept traffic
export async function GET() {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ready",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "not ready",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Database connection failed",
      },
      { status: 503 }
    );
  }
}

export const dynamic = "force-dynamic";
