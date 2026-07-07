import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "../../../../lib/prisma";
import { requireApiAdmin, requireNotDemoMode } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const admin = await requireApiAdmin();
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

    const result = await prisma.$transaction(async (tx) => {
      // Both the asset and the target user must belong to the admin's org.
      const asset = await tx.asset.findFirst({
        where: { assetid: assetId, organizationId: orgId },
        select: { assetid: true },
      });
      if (!asset) {
        throw new Error("ASSET_NOT_FOUND");
      }
      const targetUser = await tx.user.findFirst({
        where: { userid: userId, organizationId: orgId },
        select: { userid: true },
      });
      if (!targetUser) {
        throw new Error("USER_NOT_FOUND");
      }

      // Resolve the "Active" status id (case-insensitive), scoped to the org.
      const activeStatus = await tx.statusType.findFirst({
        where: {
          statustypename: { equals: "Active", mode: "insensitive" },
          organizationId: orgId,
        },
      });
      if (!activeStatus) {
        throw new Error("Status 'Active' not found in statusType");
      }

      // Check for existing assignment inside the transaction to prevent TOCTOU race
      const existingAssignment = await tx.userAssets.findFirst({
        where: { assetid: assetId },
      });

      let assignment;

      if (existingAssignment) {
        // Idempotent: if already assigned to the same user, no-op
        if (existingAssignment.userid === userId) {
          return { assignment: existingAssignment, idempotent: true };
        }
        // Reassign to the new user within the transaction
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

      return { assignment, idempotent: false };
    });

    return new Response(
      JSON.stringify({
        message: result.idempotent
          ? "Asset already assigned to this user"
          : "Asset assigned successfully",
        userAsset: result.assignment,
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
    if (
      error instanceof Error &&
      (error.message === "ASSET_NOT_FOUND" ||
        error.message === "USER_NOT_FOUND")
    ) {
      return new Response(
        JSON.stringify({ error: "Asset or user not found" }),
        { status: 404 },
      );
    }
    if (
      error instanceof Error &&
      error.message === "Status 'Active' not found in statusType"
    ) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
      });
    }
    return new Response(JSON.stringify({ error: "Error assigning asset" }), {
      status: 500,
    });
  }
}
