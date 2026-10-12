import { type NextRequest, NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

// GET /api/userAccessoires?userId=...
export async function GET(req: NextRequest) {
  try {
    const authUser = await requireApiAuth();

    // A caller without an organization owns no assignments. Never drop the
    // filter: it would list every tenant's assignments.
    const orgId = authUser.organizationId;
    if (!orgId) return NextResponse.json([], { status: 200 });

    const userId = req.nextUrl.searchParams.get("userId");
    const resolvedUserId = authUser.isAdmin ? userId : authUser.id;
    const where: Record<string, unknown> = resolvedUserId
      ? { userid: resolvedUserId }
      : {};

    // Scope through the related accessory's organizationId
    where.accessories = { organizationId: orgId };

    const rows = await prisma.userAccessoires.findMany({
      where,
      include: {
        accessories: {
          select: {
            accessorieid: true,
            accessoriename: true,
            accessorietag: true,
          },
        },
        user: {
          select: { userid: true, firstname: true, lastname: true },
        },
      },
    });
    return NextResponse.json(rows, { status: 200 });
  } catch (e) {
    const denied = apiErrorResponse(e);
    if (denied) return denied;
    logger.error("GET /api/userAccessoires error", { error: e });
    return NextResponse.json(
      { error: "Failed to fetch userAccessoires" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
