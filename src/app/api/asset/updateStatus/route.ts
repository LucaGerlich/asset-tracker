import type { NextRequest } from "next/server";
import prisma from "../../../../lib/prisma";
import { logger } from "@/lib/logger";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";

// PUT /api/asset/updateStatus
// Body: { assetId: string, statusTypeId?: string, statusName?: string }
export async function PUT(req: NextRequest) {
  const startTime = Date.now();

  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    await requirePermission("asset:edit");
    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    const { assetId, statusTypeId, statusName } = await req.json();

    if (!assetId || (!statusTypeId && !statusName)) {
      logger.warn("PUT /api/asset/updateStatus - Invalid request", {
        type: "validation_error",
        hasAssetId: !!assetId,
        hasStatusTypeId: !!statusTypeId,
        hasStatusName: !!statusName,
      });
      return new Response(
        JSON.stringify({
          error: "assetId and statusTypeId or statusName are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    let statusId = statusTypeId;
    if (!statusId && statusName) {
      const found = await prisma.statusType.findFirst({
        where: { statustypename: { equals: statusName, mode: "insensitive" } },
      });
      if (!found) {
        logger.warn("PUT /api/asset/updateStatus - Status not found", {
          statusName,
        });
        return new Response(
          JSON.stringify({ error: `Status '${statusName}' not found` }),
          { status: 404, headers: { "Content-Type": "application/json" } },
        );
      }
      statusId = found.statustypeid;
    }

    // Verify asset belongs to user's organization before updating
    const existingAsset = await prisma.asset.findFirst({
      where: scopeToOrganization({ assetid: assetId }, orgId),
    });

    if (!existingAsset) {
      return new Response(JSON.stringify({ error: "Asset not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const updated = await prisma.asset.update({
      where: { assetid: assetId },
      data: { statustypeid: statusId, change_date: new Date() },
    });

    triggerWebhook(
      "asset.updated",
      { assetId, statusChanged: true, newStatus: statusId },
      orgId,
    ).catch(() => {});
    notifyIntegrations("asset.updated", {
      assetName: updated.assetname,
      assetTag: updated.assettag,
    }).catch(() => {});

    const duration = Date.now() - startTime;
    logger.apiResponse("PUT", "/api/asset/updateStatus", 200, duration, {
      assetId,
      statusId,
    });

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.apiError("PUT", "/api/asset/updateStatus", error, { duration });

    if (error instanceof Error && error.message === "Unauthorized") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (error instanceof Error && error.message.startsWith("Forbidden")) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle Prisma-specific errors
    let errorMessage = "Failed to update status";
    let statusCode = 500;

    if (error.code === "P2025") {
      errorMessage = "Asset not found";
      statusCode = 404;
    } else if (error.code === "P2003") {
      errorMessage = "Invalid status ID - status does not exist";
      statusCode = 400;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
        code: error.code || "UNKNOWN",
      }),
      {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export const dynamic = "force-dynamic";
