import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requirePermission,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { validateBody, auditScanSchema } from "@/lib/validation";
import { triggerWebhook } from "@/lib/webhooks";
import { logger } from "@/lib/logger";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/audits/[id]/scan — Scan/mark an asset in an active campaign
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("audit_campaign:scan");
    await requireWritableOrg(authUser);
    const { id } = await params;

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const campaign = await prisma.auditCampaign.findFirst({
      where: scopeToOrganization({ id }, orgId),
    });

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

    triggerWebhook(
      "audit.asset_scanned",
      {
        campaignId: id,
        campaignName: campaign.name,
        assetId,
        status,
      },
      campaign.organizationId,
    ).catch(() => {});

    return NextResponse.json(entry, { status: 200 });
  } catch (e: any) {
    const denied = apiErrorResponse(e);
    if (denied) return denied;
    logger.error("POST /api/audits/[id]/scan error", { error: e });
    return NextResponse.json(
      { error: "Failed to scan asset" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
