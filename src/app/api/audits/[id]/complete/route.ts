import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/audits/[id]/complete — Complete an active campaign
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("audit_campaign:edit");
    const { id } = await params;

    const campaign = await prisma.auditCampaign.findUnique({
      where: { id },
      include: { entries: true },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Audit campaign not found" },
        { status: 404 },
      );
    }

    if (campaign.status !== "active") {
      return NextResponse.json(
        { error: "Only active campaigns can be completed" },
        { status: 400 },
      );
    }

    const updated = await prisma.auditCampaign.update({
      where: { id },
      data: { status: "completed", completedAt: new Date() },
    });

    // Summary stats
    const total = campaign.entries.length;
    const found = campaign.entries.filter((e) => e.status === "found").length;
    const missing = campaign.entries.filter((e) => e.status === "missing").length;
    const moved = campaign.entries.filter((e) => e.status === "moved").length;
    const unscanned = campaign.entries.filter((e) => e.status === "unscanned").length;

    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.AUDIT_CAMPAIGN,
      entityId: id,
      details: { action: "completed", total, found, missing, moved, unscanned },
    });

    triggerWebhook("audit.campaign_completed", {
      campaignId: id,
      campaignName: campaign.name,
      total,
      found,
      missing,
    }).catch(() => {});
    notifyIntegrations("audit.campaign_completed", {
      campaignName: campaign.name,
      found,
      total,
    }).catch(() => {});

    return NextResponse.json(
      { ...updated, summary: { total, found, missing, moved, unscanned } },
      { status: 200 },
    );
  } catch (e: any) {
    logger.error("POST /api/audits/[id]/complete error", { error: e });
    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to complete audit campaign" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
