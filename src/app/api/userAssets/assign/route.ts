import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "../../../../lib/prisma";
import { requireApiAdmin, requireNotDemoMode } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
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

    // Resolve the "Active" status id (case-insensitive)
    const activeStatus = await prisma.statusType.findFirst({
      where: { statustypename: { equals: "Active", mode: "insensitive" } },
    });
    if (!activeStatus) {
      return new Response(
        JSON.stringify({ error: "Status 'Active' not found in statusType" }),
        { status: 500 },
      );
    }

    // Check if the asset is already assigned
    const existingAssignment = await prisma.userAssets.findFirst({
      where: { assetid: assetId },
    });

    const result = await prisma.$transaction(async (tx) => {
      let assignment;

      if (existingAssignment) {
        assignment = await tx.userAssets.update({
          where: { userassetsid: existingAssignment.userassetsid },
          data: { userid: userId },
        });
      } else {
        assignment = await tx.userAssets.create({
          data: {
            assetid: assetId,
            userid: userId,
            creation_date: new Date(),
          } as Prisma.userAssetsUncheckedCreateInput,
        });
      }

      await tx.asset.update({
        where: { assetid: assetId },
        data: { statustypeid: activeStatus.statustypeid },
      });

      return assignment;
    });

    return new Response(
      JSON.stringify({
        message: "Asset assigned successfully",
        userAsset: result,
      }),
      {
        status: 200,
      },
    );
  } catch (error) {
    logger.error("Error assigning asset", { error });
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
    return new Response(JSON.stringify({ error: "Error assigning asset" }), {
      status: 500,
    });
  }
}
