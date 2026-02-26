import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/audits/[id]/activate — Activate a draft campaign and pre-populate entries
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("audit_campaign:edit");
    const { id } = await params;

    const campaign = await prisma.auditCampaign.findUnique({ where: { id } });

    if (!campaign) {
      return NextResponse.json(
        { error: "Audit campaign not found" },
        { status: 404 },
      );
    }

    if (campaign.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft campaigns can be activated" },
        { status: 400 },
      );
    }

    // Build asset scope filter
    const assetWhere: Record<string, unknown> = {};
    if (campaign.scopeType === "location" && campaign.scopeId) {
      assetWhere.locationid = campaign.scopeId;
    } else if (campaign.scopeType === "category" && campaign.scopeId) {
      assetWhere.assetcategorytypeid = campaign.scopeId;
    }
    // Org scoping
    if (campaign.organizationId) {
      assetWhere.organizationId = campaign.organizationId;
    }

    const assets = await prisma.asset.findMany({
      where: assetWhere,
      select: { assetid: true },
    });

    await prisma.$transaction([
      prisma.auditCampaign.update({
        where: { id },
        data: { status: "active", startDate: new Date() },
      }),
      prisma.auditEntry.createMany({
        data: assets.map((a) => ({
          campaignId: id,
          assetId: a.assetid,
          status: "unscanned",
        })),
        skipDuplicates: true,
      }),
    ]);

    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.AUDIT_CAMPAIGN,
      entityId: id,
      details: { action: "activated", assetsCount: assets.length },
    });

    return NextResponse.json(
      { message: "Campaign activated", assetsCount: assets.length },
      { status: 200 },
    );
  } catch (e: any) {
    logger.error("POST /api/audits/[id]/activate error", { error: e });
    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to activate audit campaign" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
