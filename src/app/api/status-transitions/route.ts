import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { transitionsOfOrganization } from "@/lib/status-transitions";

/**
 * GET /api/status-transitions
 *
 * Returns the caller's organization's status transitions for use in
 * status-change dropdowns (a caller without an organization gets none).
 * Available to any authenticated user (not admin-only) so the UI
 * can filter allowed status transitions.
 *
 * Response shape: Array<{ fromStatusId: string; toStatusId: string }>
 */
export async function GET() {
  try {
    const user = await requireApiAuth();

    const orgId = user.organizationId;
    if (!orgId) return NextResponse.json([], { status: 200 });

    const transitions = await prisma.status_transitions.findMany({
      where: transitionsOfOrganization(orgId),
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
