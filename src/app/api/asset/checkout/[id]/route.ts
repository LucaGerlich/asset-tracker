import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth, requireNotDemoMode } from "@/lib/api-auth";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";
import { logger } from "@/lib/logger";

// GET /api/asset/checkout/[id]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiAuth();

    const { id } = await params;

    const checkout = await prisma.assetCheckout.findUnique({
      where: { id },
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
    });

    if (!checkout) {
      return NextResponse.json(
        { error: "Checkout not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(checkout, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("GET /api/asset/checkout/[id] error", { error: message });
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message.includes("Forbidden")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch checkout" },
      { status: 500 },
    );
  }
}

// PUT /api/asset/checkout/[id] — Check-in (return asset)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const user = await requireApiAuth();

    const { id } = await params;

    const existing = await prisma.assetCheckout.findUnique({
      where: { id },
      include: {
        asset: { select: { assetid: true, assetname: true, assettag: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Checkout not found" },
        { status: 404 },
      );
    }

    const updated = await prisma.assetCheckout.update({
      where: { id },
      data: {
        returnDate: new Date(),
        status: "returned",
      },
    });

    // Audit log
    createAuditLog({
      userId: user.id as string,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.ASSET,
      entityId: existing.assetId,
      details: {
        checkoutId: id,
        checkedOutToType: existing.checkedOutToType,
        action: "check_in",
      },
    }).catch(() => {});

    // Webhook
    triggerWebhook("asset.checked_in", {
      assetId: existing.assetId,
      assetName: existing.asset?.assetname,
      checkoutId: id,
      checkedOutToType: existing.checkedOutToType,
    }).catch(() => {});

    // Slack/Teams notification
    notifyIntegrations("asset.checked_in", {
      assetName: existing.asset?.assetname,
      assetTag: existing.asset?.assettag,
      checkedOutToType: existing.checkedOutToType,
    }).catch(() => {});

    return NextResponse.json(updated, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("PUT /api/asset/checkout/[id] error", { error: message });
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message.includes("Forbidden")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to check in asset" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
