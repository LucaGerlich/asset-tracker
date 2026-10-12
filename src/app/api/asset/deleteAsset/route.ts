import type { NextRequest } from "next/server";
import prisma from "../../../../lib/prisma";
import {
  requirePermission,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { triggerWebhook } from "@/lib/webhooks";
import { invalidateCacheByPrefix } from "@/lib/cache";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { logger } from "@/lib/logger";

export async function DELETE(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const admin = await requirePermission("asset:delete");
    await requireWritableOrg(admin);
    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    const { assetId } = await req.json();

    if (!assetId) {
      return new Response(JSON.stringify({ error: "Asset ID is required" }), {
        status: 400,
      });
    }

    // Verify asset belongs to user's organization before deleting
    const asset = await prisma.asset.findFirst({
      where: scopeToOrganization({ assetid: assetId }, orgId),
    });

    if (!asset) {
      return new Response(JSON.stringify({ error: "Asset not found" }), {
        status: 404,
      });
    }

    await prisma.$transaction([
      prisma.userAssets.deleteMany({ where: { assetid: assetId } }),
      prisma.assetCheckout.deleteMany({ where: { assetId: assetId } }),
      prisma.assetReservation.deleteMany({ where: { assetId: assetId } }),
      prisma.itemRequest.deleteMany({
        where: { entityType: "asset", entityId: assetId },
      }),
      prisma.custom_field_values.deleteMany({ where: { entityId: assetId } }),
      prisma.asset_attachments.deleteMany({ where: { assetId: assetId } }),
      prisma.asset.delete({ where: { assetid: assetId } }),
    ]);

    await createAuditLog({
      userId: admin.id ?? null,
      action: AUDIT_ACTIONS.DELETE,
      entity: AUDIT_ENTITIES.ASSET,
      entityId: assetId,
      details: { assetname: asset.assetname, assettag: asset.assettag },
    });

    triggerWebhook(
      "asset.deleted",
      { assetId, assetName: asset.assetname },
      orgId,
    ).catch(() => {});

    await invalidateCacheByPrefix("assets_all").catch(() => {});
    await invalidateCacheByPrefix("asset_count").catch(() => {});
    await invalidateCacheByPrefix("asset_status_distribution").catch(() => {});

    return new Response(
      JSON.stringify({ message: "Asset deleted successfully" }),
      {
        status: 200,
      },
    );
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error deleting asset", { error });
    return new Response(JSON.stringify({ error: "Error deleting asset" }), {
      status: 500,
    });
  }
}
