import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const user = await requireApiAuth();

    // A caller without an organization owns no assignments. Never drop the
    // filter: it would list every tenant's assignments.
    const orgId = user.organizationId;
    if (!orgId) return NextResponse.json([], { status: 200 });

    const where: Record<string, unknown> = user.isAdmin
      ? {}
      : { userid: user.id };

    // Scope through the related asset's organizationId
    where.asset = { organizationId: orgId };

    const items = await prisma.userAssets.findMany({
      where,
      include: {
        asset: {
          select: { assetid: true, assetname: true, assettag: true },
        },
        user: {
          select: { userid: true, firstname: true, lastname: true },
        },
      },
    });
    return NextResponse.json(items, { status: 200 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("GET /api/userAssets error", { error });
    return NextResponse.json(
      { error: "Failed to fetch userAssets" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
