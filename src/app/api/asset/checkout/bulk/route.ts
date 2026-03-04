import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireNotDemoMode, requirePermission } from "@/lib/api-auth";
import { validateBody, bulkCheckoutSchema } from "@/lib/validations";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { logger } from "@/lib/logger";

// POST /api/asset/checkout/bulk
// Body: { assetIds, checkedOutToType, checkedOutTo?, checkedOutToLocationId?, checkedOutToAssetId?, expectedReturn?, notes? }
export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const user = await requirePermission("asset:assign");
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const body = await req.json();
    const data = validateBody(bulkCheckoutSchema, body);
    if (data instanceof NextResponse) return data;

    const {
      assetIds,
      checkedOutToType,
      checkedOutTo,
      checkedOutToLocationId,
      checkedOutToAssetId,
      expectedReturn,
      notes,
    } = data;

    // Validate the target exists based on checkedOutToType
    let targetLabel = "";

    if (checkedOutToType === "user") {
      const targetUser = await prisma.user.findUnique({
        where: { userid: checkedOutTo! },
      });
      if (!targetUser) {
        return NextResponse.json(
          { error: "Target user not found" },
          { status: 404 },
        );
      }
      targetLabel = `${targetUser.firstname} ${targetUser.lastname}`;
    } else if (checkedOutToType === "location") {
      const targetLocation = await prisma.location.findUnique({
        where: { locationid: checkedOutToLocationId! },
      });
      if (!targetLocation) {
        return NextResponse.json(
          { error: "Target location not found" },
          { status: 404 },
        );
      }
      targetLabel = targetLocation.locationname || "Unknown location";
    } else if (checkedOutToType === "asset") {
      const targetAsset = await prisma.asset.findUnique({
        where: { assetid: checkedOutToAssetId! },
      });
      if (!targetAsset) {
        return NextResponse.json(
          { error: "Target asset not found" },
          { status: 404 },
        );
      }
      targetLabel = targetAsset.assetname || targetAsset.assettag;
    }

    // Fetch all requested assets scoped to organization
    const foundAssets = await prisma.asset.findMany({
      where: scopeToOrganization({ assetid: { in: assetIds } }, orgId),
    });

    const foundAssetIds = new Set(foundAssets.map((a) => a.assetid));
    const missingAssetIds = assetIds.filter(
      (id: string) => !foundAssetIds.has(id),
    );

    // Prevent checking out an asset to itself
    if (checkedOutToType === "asset") {
      const selfCheckouts = foundAssets.filter(
        (a) => a.assetid === checkedOutToAssetId,
      );
      if (selfCheckouts.length > 0) {
        return NextResponse.json(
          { error: "Cannot check out an asset to itself" },
          { status: 400 },
        );
      }
    }

    // Create all checkouts atomically
    const checkouts = await prisma.$transaction(
      foundAssets.map((asset) =>
        prisma.assetCheckout.create({
          data: {
            assetId: asset.assetid,
            checkedOutToType,
            checkedOutTo: checkedOutToType === "user" ? checkedOutTo : null,
            checkedOutToLocationId:
              checkedOutToType === "location" ? checkedOutToLocationId : null,
            checkedOutToAssetId:
              checkedOutToType === "asset" ? checkedOutToAssetId : null,
            checkedOutBy: user.id as string,
            expectedReturn: expectedReturn ? new Date(expectedReturn) : null,
            notes: notes || null,
            status: "checked_out",
          },
        }),
      ),
    );

    // Audit log
    createAuditLog({
      userId: user.id as string,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.ASSET,
      entityId: null,
      details: {
        bulkCheckout: true,
        assetCount: checkouts.length,
        checkedOutToType,
        targetLabel,
        assetIds: foundAssets.map((a) => a.assetid),
      },
    }).catch(() => {});

    // Webhook
    triggerWebhook("asset.bulk_checked_out", {
      count: checkouts.length,
      checkedOutToType,
      targetLabel,
      assetIds: foundAssets.map((a) => a.assetid),
    }).catch(() => {});

    // Slack/Teams notification
    notifyIntegrations("asset.bulk_checked_out", {
      count: checkouts.length,
      targetLabel,
      checkedOutToType,
    }).catch(() => {});

    const failed = missingAssetIds.map((id: string) => ({
      assetId: id,
      reason: "Asset not found",
    }));

    return NextResponse.json({ success: checkouts, failed }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("POST /api/asset/checkout/bulk error", { error: message });
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message.includes("Forbidden")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to create bulk checkout" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
