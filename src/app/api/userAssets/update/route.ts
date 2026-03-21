import type { NextRequest } from "next/server";
import prisma from "../../../../lib/prisma";
import { requireApiAdmin, requireNotDemoMode } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

export async function PUT(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    await requireApiAdmin();
    const { userAssetsId, userId } = await req.json();

    if (!userAssetsId || !userId) {
      logger.error("Missing userAssetsId or userId", {
        error: { userAssetsId, userId },
      });
      return new Response(
        JSON.stringify({ error: "UserAssets ID and User ID are required" }),
        {
          status: 400,
        },
      );
    }

    const updatedUserAsset = await prisma.userAssets.update({
      where: {
        userassetsid: userAssetsId,
      },
      data: {
        userid: userId,
        change_date: new Date(),
      },
    });

    return new Response(
      JSON.stringify({
        message: "UserAsset updated successfully",
        userAsset: updatedUserAsset,
      }),
      {
        status: 200,
      },
    );
  } catch (error) {
    logger.error("Error updating UserAsset", { error });
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
    return new Response(JSON.stringify({ error: "Error updating UserAsset" }), {
      status: 500,
    });
  }
}
