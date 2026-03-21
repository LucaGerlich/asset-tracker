import type { NextRequest } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

// GET /api/userAssets/findByAssetId?assetId=<id>
export async function GET(req: NextRequest) {
  try {
    const user = await requireApiAuth();
    const assetId = req.nextUrl.searchParams.get("assetId");

    if (!assetId) {
      return new Response(JSON.stringify({ error: "Asset ID is required" }), {
        status: 400,
      });
    }

    const where = user.isAdmin
      ? { assetid: assetId }
      : { assetid: assetId, userid: user.id };

    const userAsset = await prisma.userAssets.findFirst({ where });

    if (!userAsset) {
      return new Response(JSON.stringify({ error: "UserAsset not found" }), {
        status: 404,
      });
    }

    return new Response(JSON.stringify({ userAsset }), {
      status: 200,
    });
  } catch (error) {
    logger.error("Error finding UserAsset", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }
    return new Response(JSON.stringify({ error: "Error finding UserAsset" }), {
      status: 500,
    });
  }
}
