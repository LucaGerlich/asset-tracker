import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

// GET /api/health
export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, { status: string; message?: string; duration?: number }> = {};

  try {
    // Check database connection
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = {
        status: "healthy",
        duration: Date.now() - dbStart,
      };
    } catch (error) {
      logger.error("Health check: Database connection failed", { error });
      checks.database = {
        status: "unhealthy",
        message: error instanceof Error ? error.message : "Database connection failed",
        duration: Date.now() - dbStart,
      };
    }

    // Check environment variables
    const requiredEnvVars = ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"];
    const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);
    
    checks.environment = {
      status: missingEnvVars.length === 0 ? "healthy" : "unhealthy",
      message: missingEnvVars.length > 0 
        ? `Missing environment variables: ${missingEnvVars.join(", ")}`
        : undefined,
    };

    // Overall health status
    const isHealthy = Object.values(checks).every((check) => check.status === "healthy");
    const status = isHealthy ? 200 : 503;

    const response = {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || "unknown",
      checks,
      responsetime: Date.now() - startTime,
    };

    logger.info("Health check completed", {
      type: "health_check",
      status: response.status,
      duration: response.responsetime,
    });

    return NextResponse.json(response, { status });
  } catch (error) {
    logger.error("Health check failed", { error });
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Health check failed",
      },
      { status: 503 }
    );
  }
}

export const dynamic = "force-dynamic";
