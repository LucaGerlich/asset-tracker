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

    // The assignment (through its asset) and the new holder must both belong to
    // the admin's organization. A caller without an organization owns neither;
    // never widen the lookups to every organization.
    const orgId = admin.organizationId;
    if (
      !orgId ||
      typeof userAssetsId !== "string" ||
      typeof userId !== "string"
    ) {
      return new Response(JSON.stringify({ error: "UserAsset not found" }), {
        status: 404,
      });
    }

    const [assignment, newHolder] = await Promise.all([
      prisma.userAssets.findFirst({
        where: { userassetsid: userAssetsId, asset: { organizationId: orgId } },
        select: { userassetsid: true },
      }),
      prisma.user.findFirst({
        where: { userid: userId, organizationId: orgId },
        select: { userid: true },
      }),
    ]);
    if (!assignment || !newHolder) {
      return new Response(JSON.stringify({ error: "UserAsset not found" }), {
        status: 404,
      });
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
