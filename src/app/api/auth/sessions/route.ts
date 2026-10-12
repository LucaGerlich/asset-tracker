import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { getUserSessions } from "@/lib/session-tracking";
import { logger } from "@/lib/logger";

/**
 * GET /api/auth/sessions
 * List all active sessions for the current user
 */
export async function GET() {
  try {
    const user = await requireApiAuth();

    if (!user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessions = await getUserSessions(user.id);

    return NextResponse.json({ sessions });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Failed to fetch sessions", { error });
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
