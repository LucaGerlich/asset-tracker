import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { updateAutomationRuleSchema, validateBody } from "@/lib/validation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function ruleNotFound() {
  return NextResponse.json(
    { error: "Automation rule not found" },
    { status: 404 },
  );
}

// GET /api/admin/workflows/[id] - Get single automation rule
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const user = await requireApiAdmin();
    const { id } = await params;

    // A user without an organization owns no rules. Never pass an undefined
    // organizationId to Prisma: it would drop the filter and match any org.
    const orgId = user.organizationId;
    if (!orgId) return ruleNotFound();

    const rule = await prisma.automationRule.findFirst({
      where: { id, organizationId: orgId },
      include: {
        creator: {
          select: {
            userid: true,
            firstname: true,
            lastname: true,
          },
        },
      },
    });

    if (!rule) return ruleNotFound();

    return NextResponse.json(rule, { status: 200 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("GET /api/admin/workflows/[id] error", { error });
    return NextResponse.json(
      { error: "Failed to fetch automation rule" },
      { status: 500 },
    );
  }
}

// PUT /api/admin/workflows/[id] - Update automation rule
export async function PUT(req: Request, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAdmin();
    await requireWritableOrg(user);
    const { id } = await params;

    const orgId = user.organizationId;
    if (!orgId) return ruleNotFound();

    const existing = await prisma.automationRule.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!existing) return ruleNotFound();

    const body = await req.json();
    const validated = validateBody(updateAutomationRuleSchema, body);
    if (validated instanceof NextResponse) return validated;
    const { name, description, trigger, conditions, actions, isActive } =
      validated;

    const rule = await prisma.automationRule.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(trigger !== undefined && { trigger }),
        ...(conditions !== undefined && {
          conditions:
            typeof conditions === "string"
              ? conditions
              : JSON.stringify(conditions),
        }),
        ...(actions !== undefined && {
          actions:
            typeof actions === "string" ? actions : JSON.stringify(actions),
        }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        creator: {
          select: {
            userid: true,
            firstname: true,
            lastname: true,
          },
        },
      },
    });

    await createAuditLog({
      userId: user.id || null,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.ASSET,
      entityId: id,
      details: {
        type: "automation_rule",
        name: rule.name,
        changes: validated,
      },
    });

    return NextResponse.json(rule, { status: 200 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("PUT /api/admin/workflows/[id] error", { error });
    return NextResponse.json(
      { error: "Failed to update automation rule" },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/workflows/[id] - Delete automation rule
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAdmin();
    await requireWritableOrg(user);
    const { id } = await params;

    const orgId = user.organizationId;
    if (!orgId) return ruleNotFound();

    const rule = await prisma.automationRule.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!rule) return ruleNotFound();

    await prisma.automationRule.delete({ where: { id } });

    await createAuditLog({
      userId: user.id || null,
      action: AUDIT_ACTIONS.DELETE,
      entity: AUDIT_ENTITIES.ASSET,
      entityId: id,
      details: {
        type: "automation_rule",
        name: rule.name,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("DELETE /api/admin/workflows/[id] error", { error });
    return NextResponse.json(
      { error: "Failed to delete automation rule" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
