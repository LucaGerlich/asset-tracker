import type { NextRequest } from "next/server";
import prisma from "../../../../lib/prisma";
import { logger, logCatchError } from "@/lib/logger";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";
import { checkVersion, CONFLICT_MESSAGE } from "@/lib/concurrency";

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

    const { assetId, statusTypeId, statusName, _expectedVersion } =
      await req.json();

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

    // Atomic: re-read current status + validate transition + update inside transaction
    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        // Re-read inside transaction to get latest status
        const current = await tx.asset.findUnique({
          where: { assetid: assetId },
          select: { statustypeid: true, change_date: true },
        });

        if (!current) throw new Error("ASSET_NOT_FOUND");

        if (!checkVersion(_expectedVersion, current.change_date)) {
          throw new Error("VERSION_CONFLICT");
        }

        // Enforce status workflow transitions (if any are defined)
        if (current.statustypeid && current.statustypeid !== statusId) {
          const transitionCount = await tx.status_transitions.count();
          if (transitionCount > 0) {
            const allowed = await tx.status_transitions.findUnique({
              where: {
                fromStatusId_toStatusId: {
                  fromStatusId: current.statustypeid,
                  toStatusId: statusId,
                },
              },
            });
            if (!allowed) {
              throw new Error("TRANSITION_NOT_ALLOWED");
            }
          }
        }

        // Idempotent: if already at target status, return current
        if (current.statustypeid === statusId) {
          return tx.asset.findUnique({ where: { assetid: assetId } });
        }

        return tx.asset.update({
          where: { assetid: assetId },
          data: { statustypeid: statusId, change_date: new Date() },
        });
      });
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === "ASSET_NOT_FOUND") {
          return new Response(JSON.stringify({ error: "Asset not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (err.message === "VERSION_CONFLICT") {
          return new Response(JSON.stringify({ error: CONFLICT_MESSAGE }), {
            status: 409,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (err.message === "TRANSITION_NOT_ALLOWED") {
          return new Response(
            JSON.stringify({ error: "This status transition is not allowed" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
      }
      throw err;
    }

    triggerWebhook(
      "asset.updated",
      { assetId, statusChanged: true, newStatus: statusId },
      orgId,
    ).catch(() => {});
    notifyIntegrations("asset.updated", {
      assetName: updated.assetname,
      assetTag: updated.assettag,
    }).catch(logCatchError("Integration notification failed"));

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
