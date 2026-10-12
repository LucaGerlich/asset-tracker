import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth, type AuthUser } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user: AuthUser = await requireApiAuth();

    const userAssets = await prisma.userAssets.findMany({
      where: { userid: user.id },
      include: {
        asset: {
          include: { statusType: true },
        },
      },
    });

    const assets = userAssets.map((ua) => ({
      id: ua.assetid,
      name: ua.asset.assetname,
      tag: ua.asset.assettag,
      status: ua.asset.statusType?.statustypename || null,
    }));

    return NextResponse.json(assets);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("GET /api/dashboard/my-assets error", { error });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
