import type { NextRequest } from "next/server";
import prisma from "../../../../lib/prisma";
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function DELETE(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const admin = await requireApiAdmin();
    await requireWritableOrg(admin);
    const { assetId, userId } = await req.json();

    if (!assetId || !userId) {
      return new Response(
        JSON.stringify({ error: "Asset ID and User ID are required" }),
        {
          status: 400,
        },
      );
    }

    const orgId = admin.organizationId ?? null;

    // The asset must belong to the admin's organization.
    const asset = await prisma.asset.findFirst({
      where: { assetid: assetId, organizationId: orgId },
      select: { assetid: true },
    });
    if (!asset) {
      return new Response(JSON.stringify({ error: "Asset not found" }), {
        status: 404,
      });
    }

    // Resolve the "Available" status id (case-insensitive), scoped to the org.
    const availableStatus = await prisma.statusType.findFirst({
      where: {
        statustypename: { equals: "Available", mode: "insensitive" },
        organizationId: orgId,
      },
    });
    if (!availableStatus) {
      return new Response(
        JSON.stringify({ error: "Status 'Available' not found in statusType" }),
        { status: 500 },
      );
    }

    const deletedAsset = await prisma.$transaction(async (tx) => {
      const deleted = await tx.userAssets.deleteMany({
        where: {
          assetid: assetId,
          userid: userId,
        },
      });

      await tx.asset.update({
        where: { assetid: assetId },
        data: { statustypeid: availableStatus.statustypeid },
      });

      return deleted;
    });

    return new Response(
      JSON.stringify({
        message: "Asset unassigned successfully",
        asset: deletedAsset,
      }),
      {
        status: 200,
      },
    );
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error unassigning asset", { error });
    return new Response(JSON.stringify({ error: "Error unassigning asset" }), {
      status: 500,
    });
  }
}
