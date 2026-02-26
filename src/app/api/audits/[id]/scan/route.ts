import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { validateBody, auditScanSchema } from "@/lib/validations";
import { triggerWebhook } from "@/lib/webhooks";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/audits/[id]/scan — Scan/mark an asset in an active campaign
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("audit_campaign:scan");
    const { id } = await params;

    const campaign = await prisma.auditCampaign.findUnique({ where: { id } });

    if (!campaign) {
      return NextResponse.json(
        { error: "Audit campaign not found" },
        { status: 404 },
      );
    }

    if (campaign.status !== "active") {
      return NextResponse.json(
        { error: "Campaign must be active to scan assets" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const validated = validateBody(auditScanSchema, body);
    if (validated instanceof NextResponse) return validated;

    const { assetId, locationId, status, notes } = validated;

    const entry = await prisma.auditEntry.upsert({
      where: { campaignId_assetId: { campaignId: id, assetId } },
      update: {
        status,
        auditedBy: authUser.id,
        auditedAt: new Date(),
        locationId: locationId ?? null,
        notes: notes ?? null,
      },
      create: {
        campaignId: id,
        assetId,
        status,
        auditedBy: authUser.id,
        auditedAt: new Date(),
        locationId: locationId ?? null,
        notes: notes ?? null,
      },
    });

    triggerWebhook("audit.asset_scanned", {
      campaignId: id,
      campaignName: campaign.name,
      assetId,
      status,
    }).catch(() => {});

    return NextResponse.json(entry, { status: 200 });
  } catch (e: any) {
    logger.error("POST /api/audits/[id]/scan error", { error: e });
    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to scan asset" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
