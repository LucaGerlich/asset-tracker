import type { NextRequest } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireApiAdmin, requireNotDemoMode } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

export async function DELETE(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    await requireApiAdmin();
    const { assetId, userId } = await req.json();

    if (!assetId || !userId) {
      return new Response(
        JSON.stringify({ error: "Asset ID and User ID are required" }),
        {
          status: 400,
        },
      );
    }

    // Resolve the "Available" status id (case-insensitive)
    const availableStatus = await prisma.statusType.findFirst({
      where: { statustypename: { equals: "Available", mode: "insensitive" } },
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
    logger.error("Error unassigning asset", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 403,
      });
    }
    return new Response(JSON.stringify({ error: "Error unassigning asset" }), {
      status: 500,
    });
  }
}
