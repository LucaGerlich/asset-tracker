import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requirePermission,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
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
    await requireWritableOrg(authUser);
    const { id } = await params;

    // A caller without an organization owns no campaigns; never widen the
    // lookup to every organization.
    const orgId = authUser.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "Audit campaign not found" },
        { status: 404 },
      );
    }

    const campaign = await prisma.auditCampaign.findFirst({
      where: { id, organizationId: orgId },
    });

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

    const assetWhere: Record<string, unknown> = {};
    if (campaign.scopeType === "location" && campaign.scopeId) {
      assetWhere.locationid = campaign.scopeId;
    } else if (campaign.scopeType === "category" && campaign.scopeId) {
      assetWhere.assetcategorytypeid = campaign.scopeId;
    }
    assetWhere.organizationId = orgId;

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
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("POST /api/audits/[id]/activate error", { error });
    return NextResponse.json(
      { error: "Failed to activate audit campaign" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
