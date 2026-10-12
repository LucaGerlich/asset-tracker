import type { NextRequest } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { logger } from "@/lib/logger";

// GET /api/userAssets/findByAssetId?assetId=<id>
export async function GET(req: NextRequest) {
  try {
    const user = await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;
    const assetId = req.nextUrl.searchParams.get("assetId");

    if (!assetId) {
      return new Response(JSON.stringify({ error: "Asset ID is required" }), {
        status: 400,
      });
    }

    // Verify the asset belongs to the user's organization
    const asset = await prisma.asset.findFirst({
      where: scopeToOrganization({ assetid: assetId }, orgId),
      select: { assetid: true },
    });

    if (!asset) {
      return new Response(JSON.stringify({ error: "Asset not found" }), {
        status: 404,
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
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error finding UserAsset", { error });
    return new Response(JSON.stringify({ error: "Error finding UserAsset" }), {
      status: 500,
    });
  }
}
