import { type NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { getOrganizationContext } from "@/lib/organization-context";
import { logger } from "@/lib/logger";

// GET /api/user/validate?username=...&email=...&excludeId=...
export async function GET(req: NextRequest) {
  try {
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const url = req.nextUrl;
    const username = url.searchParams.get("username");
    const email = url.searchParams.get("email");
    const excludeId = url.searchParams.get("excludeId");
    const result: Record<string, { exists: boolean }> = {};

    if (username) {
      const byUsername = await prisma.user.findFirst({
        where: {
          username,
          ...(orgId ? { organizationId: orgId } : {}),
        },
      });
      result.username = {
        exists: Boolean(
          byUsername && (!excludeId || byUsername.userid !== excludeId),
        ),
      };
    }
    if (email) {
      const byEmail = await prisma.user.findFirst({
        where: {
          email,
          ...(orgId ? { organizationId: orgId } : {}),
        },
      });
      result.email = {
        exists: Boolean(
          byEmail && (!excludeId || byEmail.userid !== excludeId),
        ),
      };
    }

    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    const denied = apiErrorResponse(e);
    if (denied) return denied;
    logger.error("GET /api/user/validate error", { error: e });
    return NextResponse.json({ error: "Validation error" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
