import type { NextRequest } from "next/server";
import prisma from "../../../../lib/prisma";
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function PUT(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const admin = await requireApiAdmin();
    await requireWritableOrg(admin);
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
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error updating UserAsset", { error });
    return new Response(JSON.stringify({ error: "Error updating UserAsset" }), {
      status: 500,
    });
  }
}
