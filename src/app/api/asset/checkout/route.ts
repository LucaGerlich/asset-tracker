import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth, requireNotDemoMode } from "@/lib/api-auth";
import { validateBody, assetCheckoutSchema } from "@/lib/validation";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { logger } from "@/lib/logger";

// GET /api/asset/checkout?assetId=<uuid>
export async function GET(req: Request) {
  try {
    await requireApiAuth();

    const url = new URL(req.url);
    const assetId = url.searchParams.get("assetId");

    if (!assetId) {
      return NextResponse.json(
        { error: "assetId query parameter is required" },
        { status: 400 },
      );
    }

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;
    const asset = await prisma.asset.findFirst({
      where: scopeToOrganization({ assetid: assetId }, orgId),
    });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const checkouts = await prisma.assetCheckout.findMany({
      where: { assetId },
      include: {
        checkedOutToUser: {
          select: { userid: true, firstname: true, lastname: true },
        },
        checkedOutByUser: {
          select: { userid: true, firstname: true, lastname: true },
        },
        checkedOutToLocation: {
          select: { locationid: true, locationname: true },
        },
        checkedOutToAsset: {
          select: { assetid: true, assetname: true, assettag: true },
        },
      },
      orderBy: { checkoutDate: "desc" },
    });

    return NextResponse.json(checkouts, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("GET /api/asset/checkout error", { error: message });
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message.includes("Forbidden")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch checkouts" },
      { status: 500 },
    );
  }
}

// POST /api/asset/checkout
// Body: { assetId, checkedOutToType?, checkedOutTo?, checkedOutToLocationId?, checkedOutToAssetId?, expectedReturn?, notes? }
export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const user = await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const body = await req.json();
    const data = validateBody(assetCheckoutSchema, body);
    if (data instanceof NextResponse) return data;

    const {
      assetId,
      checkedOutToType,
      checkedOutTo,
      checkedOutToLocationId,
      checkedOutToAssetId,
      expectedReturn,
      notes,
    } = data;

    // Validate asset exists and belongs to user's organization
    const asset = await prisma.asset.findFirst({
      where: scopeToOrganization({ assetid: assetId }, orgId),
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

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
      if (checkedOutToAssetId === assetId) {
        return NextResponse.json(
          { error: "Cannot check out an asset to itself" },
          { status: 400 },
        );
      }
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

    const checkout = await prisma.assetCheckout.create({
      data: {
        assetId,
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
    });

    // Audit log
    createAuditLog({
      userId: user.id as string,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.ASSET,
      entityId: assetId,
      details: {
        checkoutId: checkout.id,
        checkedOutToType,
        targetLabel,
      },
    }).catch(() => {});

    // Webhook
    triggerWebhook("asset.checked_out", {
      assetId,
      assetName: asset.assetname,
      checkoutId: checkout.id,
      checkedOutToType,
      targetLabel,
    }).catch(() => {});

    // Slack/Teams notification
    notifyIntegrations("asset.checked_out", {
      assetName: asset.assetname,
      assetTag: asset.assettag,
      checkedOutToType,
      targetLabel,
    }).catch(() => {});

    return NextResponse.json(checkout, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("POST /api/asset/checkout error", { error: message });
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message.includes("Forbidden")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to create checkout" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
