import { NextResponse } from "next/server";

// GET /api/health/live - Liveness probe
// Returns 200 if the application is running
export async function GET() {
  return NextResponse.json(
    {
      status: "alive",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}

export const dynamic = "force-dynamic";
