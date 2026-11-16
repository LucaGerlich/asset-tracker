import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  requireNotDemoMode,
  requirePermission,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { validateBody, bulkCheckoutSchema } from "@/lib/validation";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { logger, logCatchError } from "@/lib/logger";
import {
  ACTIVE_CHECKOUT_STATUSES,
  isCheckoutConflict,
} from "@/lib/asset-checkout";

// POST /api/asset/checkout/bulk
// Body: { assetIds, checkedOutToType, checkedOutTo?, checkedOutToLocationId?, checkedOutToAssetId?, expectedReturn?, notes? }
export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const user = await requirePermission("asset:assign");
    await requireWritableOrg(user);
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

    let targetLabel = "";

    if (checkedOutToType === "user") {
      const targetUser = await prisma.user.findFirst({
        where: { userid: checkedOutTo!, organizationId: orgId ?? null },
      });
      if (!targetUser) {
        return NextResponse.json(
          { error: "Target user not found" },
          { status: 404 },
        );
      }
      targetLabel = `${targetUser.firstname} ${targetUser.lastname}`;
    } else if (checkedOutToType === "location") {
      const targetLocation = await prisma.location.findFirst({
        where: {
          locationid: checkedOutToLocationId!,
          organizationId: orgId ?? null,
        },
      });
      if (!targetLocation) {
        return NextResponse.json(
          { error: "Target location not found" },
          { status: 404 },
        );
      }
      targetLabel = targetLocation.locationname || "Unknown location";
    } else if (checkedOutToType === "asset") {
      const targetAsset = await prisma.asset.findFirst({
        where: { assetid: checkedOutToAssetId!, organizationId: orgId ?? null },
      });
      if (!targetAsset) {
        return NextResponse.json(
          { error: "Target asset not found" },
          { status: 404 },
        );
      }
      targetLabel = targetAsset.assetname || targetAsset.assettag;
    }

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

    // Assets that are already out are reported as failed instead of being
    // checked out a second time. The check and the inserts share one
    // serializable transaction so concurrent requests cannot both win.
    const alreadyOut = new Set<string>();
    const checkouts = await prisma.$transaction(
      async (tx) => {
        alreadyOut.clear();
        const active = await tx.assetCheckout.findMany({
          where: {
            assetId: { in: foundAssets.map((a) => a.assetid) },
            status: { in: ACTIVE_CHECKOUT_STATUSES },
          },
          select: { assetId: true },
        });
        for (const checkout of active) alreadyOut.add(checkout.assetId);

        const created = [];
        for (const asset of foundAssets) {
          if (alreadyOut.has(asset.assetid)) continue;
          created.push(
            await tx.assetCheckout.create({
              data: {
                assetId: asset.assetid,
                checkedOutToType,
                checkedOutTo: checkedOutToType === "user" ? checkedOutTo : null,
                checkedOutToLocationId:
                  checkedOutToType === "location"
                    ? checkedOutToLocationId
                    : null,
                checkedOutToAssetId:
                  checkedOutToType === "asset" ? checkedOutToAssetId : null,
                checkedOutBy: user.id as string,
                expectedReturn: expectedReturn
                  ? new Date(expectedReturn)
                  : null,
                notes: notes || null,
                status: "checked_out",
              },
            }),
          );
        }
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (checkouts.length === 0 && alreadyOut.size > 0) {
      return NextResponse.json(
        { error: "All selected assets are already checked out" },
        { status: 409 },
      );
    }

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
        assetIds: checkouts.map((c) => c.assetId),
      },
    }).catch(logCatchError("Audit log failed"));

    triggerWebhook(
      "asset.bulk_checked_out",
      {
        count: checkouts.length,
        checkedOutToType,
        targetLabel,
        assetIds: checkouts.map((c) => c.assetId),
      },
      orgId,
    ).catch(() => {});

    // Slack/Teams notification
    notifyIntegrations("asset.bulk_checked_out", {
      count: checkouts.length,
      targetLabel,
      checkedOutToType,
    }).catch(logCatchError("Integration notification failed"));

    const failed = [
      ...missingAssetIds.map((id: string) => ({
        assetId: id,
        reason: "Asset not found",
      })),
      ...[...alreadyOut].map((id) => ({
        assetId: id,
        reason: "Asset is already checked out",
      })),
    ];

    return NextResponse.json({ success: checkouts, failed }, { status: 201 });
  } catch (error: unknown) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    if (isCheckoutConflict(error)) {
      return NextResponse.json(
        { error: "Assets were checked out concurrently, please retry" },
        { status: 409 },
      );
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("POST /api/asset/checkout/bulk error", { error: message });
    return NextResponse.json(
      { error: "Failed to create bulk checkout" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
