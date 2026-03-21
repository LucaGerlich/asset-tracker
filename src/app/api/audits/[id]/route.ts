import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { validateBody, updateAuditCampaignSchema } from "@/lib/validation";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/audits/[id]
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("audit_campaign:view");
    const { id } = await params;

    const campaign = await prisma.auditCampaign.findUnique({
      where: { id },
      include: {
        creator: { select: { userid: true, firstname: true, lastname: true } },
        auditors: {
          include: {
            user: { select: { userid: true, firstname: true, lastname: true } },
          },
        },
        entries: {
          include: {
            asset: {
              select: { assetid: true, assetname: true, assettag: true },
            },
            auditor: {
              select: { userid: true, firstname: true, lastname: true },
            },
            location: { select: { locationid: true, locationname: true } },
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Audit campaign not found" },
        { status: 404 },
      );
    }

    // Compute summary stats
    const summary = {
      total: campaign.entries.length,
      found: campaign.entries.filter((e) => e.status === "found").length,
      missing: campaign.entries.filter((e) => e.status === "missing").length,
      moved: campaign.entries.filter((e) => e.status === "moved").length,
      unscanned: campaign.entries.filter((e) => e.status === "unscanned")
        .length,
    };

    return NextResponse.json({ ...campaign, summary }, { status: 200 });
  } catch (e: any) {
    logger.error("GET /api/audits/[id] error", { error: e });
    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch audit campaign" },
      { status: 500 },
    );
  }
}

// PUT /api/audits/[id]
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("audit_campaign:edit");
    const { id } = await params;

    const body = await req.json();
    const validated = validateBody(updateAuditCampaignSchema, body);
    if (validated instanceof NextResponse) return validated;

    const updateData: Record<string, unknown> = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.description !== undefined)
      updateData.description = validated.description;
    if (validated.dueDate !== undefined) {
      updateData.dueDate = validated.dueDate
        ? new Date(validated.dueDate)
        : null;
    }
    if (validated.scopeType !== undefined)
      updateData.scopeType = validated.scopeType;
    if (validated.scopeId !== undefined) updateData.scopeId = validated.scopeId;

    const updated = await prisma.auditCampaign.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.AUDIT_CAMPAIGN,
      entityId: updated.id,
      details: { name: updated.name },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e: any) {
    logger.error("PUT /api/audits/[id] error", { error: e });
    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Audit campaign not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Failed to update audit campaign" },
      { status: 500 },
    );
  }
}

// DELETE /api/audits/[id]
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("audit_campaign:edit");
    const { id } = await params;

    const campaign = await prisma.auditCampaign.findUnique({
      where: { id },
      select: { name: true },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Audit campaign not found" },
        { status: 404 },
      );
    }

    await prisma.auditCampaign.delete({ where: { id } });

    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.DELETE,
      entity: AUDIT_ENTITIES.AUDIT_CAMPAIGN,
      entityId: id,
      details: { name: campaign.name },
    });

    return NextResponse.json(
      { message: "Audit campaign deleted successfully" },
      { status: 200 },
    );
  } catch (e: any) {
    logger.error("DELETE /api/audits/[id] error", { error: e });
    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to delete audit campaign" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
