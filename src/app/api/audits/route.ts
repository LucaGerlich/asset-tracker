import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requirePermission, requireNotDemoMode } from "@/lib/api-auth";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import {
  validateBody,
  createAuditCampaignSchema,
  updateAuditCampaignSchema,
} from "@/lib/validation";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";
import { logger } from "@/lib/logger";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";

const AUDIT_SORT_FIELDS = ["name", "status", "createdAt"];

// GET /api/audits
export async function GET(req: Request) {
  try {
    await requirePermission("audit_campaign:view");
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const { searchParams } = new URL(req.url);

    if (!searchParams.has("page")) {
      const where = scopeToOrganization({}, orgId);
      const items = await prisma.auditCampaign.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          creator: {
            select: { userid: true, firstname: true, lastname: true },
          },
          _count: { select: { entries: true, auditors: true } },
        },
      });
      return NextResponse.json(items, { status: 200 });
    }

    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, AUDIT_SORT_FIELDS);
    const where: Record<string, unknown> = scopeToOrganization({}, orgId);

    if (params.search) {
      where.name = { contains: params.search, mode: "insensitive" };
    }

    const [items, total] = await Promise.all([
      prisma.auditCampaign.findMany({
        where,
        ...prismaArgs,
        include: {
          creator: {
            select: { userid: true, firstname: true, lastname: true },
          },
          _count: { select: { entries: true, auditors: true } },
        },
      }),
      prisma.auditCampaign.count({ where }),
    ]);

    return NextResponse.json(buildPaginatedResponse(items, total, params), {
      status: 200,
    });
  } catch (e: any) {
    logger.error("GET /api/audits error", { error: e });
    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch audit campaigns" },
      { status: 500 },
    );
  }
}

// POST /api/audits
export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("audit_campaign:create");

    const body = await req.json();
    const validated = validateBody(createAuditCampaignSchema, body);
    if (validated instanceof NextResponse) return validated;

    const { name, description, dueDate, scopeType, scopeId, auditorIds } =
      validated;

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const campaign = await prisma.$transaction(async (tx) => {
      const created = await tx.auditCampaign.create({
        data: {
          name,
          description: description ?? null,
          dueDate: dueDate ? new Date(dueDate) : null,
          scopeType,
          scopeId: scopeId ?? null,
          createdBy: authUser.id,
          organizationId: orgId ?? null,
        },
      });

      if (auditorIds?.length) {
        await tx.auditCampaignAuditor.createMany({
          data: auditorIds.map((userId: string) => ({
            campaignId: created.id,
            userId,
          })),
        });
      }

      return created;
    });

    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.AUDIT_CAMPAIGN,
      entityId: campaign.id,
      details: { name },
    });

    triggerWebhook("audit.campaign_created", {
      campaignId: campaign.id,
      campaignName: campaign.name,
    }).catch(() => {});
    notifyIntegrations("audit.campaign_created", {
      campaignName: campaign.name,
    }).catch(() => {});

    return NextResponse.json(campaign, { status: 201 });
  } catch (e: any) {
    logger.error("POST /api/audits error", { error: e });
    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (e.message?.startsWith("Forbidden")) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to create audit campaign" },
      { status: 500 },
    );
  }
}

// DELETE /api/audits
export async function DELETE(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const authUser = await requirePermission("audit_campaign:edit");

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Campaign ID is required" },
        { status: 400 },
      );
    }

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
    logger.error("DELETE /api/audits error", { error: e });
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
