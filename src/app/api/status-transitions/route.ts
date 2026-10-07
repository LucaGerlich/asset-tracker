import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * GET /api/status-transitions
 *
 * Returns all status transitions for use in status-change dropdowns.
 * Available to any authenticated user (not admin-only) so the UI
 * can filter allowed status transitions.
 *
 * Response shape: Array<{ fromStatusId: string; toStatusId: string }>
 */
export async function GET() {
  try {
    await requireApiAuth();

    const transitions = await prisma.status_transitions.findMany({
      select: {
        fromStatusId: true,
        toStatusId: true,
      },
    });

    return NextResponse.json(transitions);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("GET /api/status-transitions error", { error });
    return NextResponse.json(
      { error: "Failed to fetch transitions" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
