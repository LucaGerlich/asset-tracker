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

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/workflows/[id] - Get single automation rule
export async function GET(req: Request, { params }: RouteParams) {
  try {
    await requireApiAdmin();
    const { id } = await params;

    const rule = await prisma.automationRule.findUnique({
      where: { id },
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

    if (!rule) {
      return NextResponse.json(
        { error: "Automation rule not found" },
        { status: 404 },
      );
    }

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
    const body = await req.json();
    const { name, description, trigger, conditions, actions, isActive } = body;

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
        changes: body,
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

    const rule = await prisma.automationRule.findUnique({ where: { id } });

    if (!rule) {
      return NextResponse.json(
        { error: "Automation rule not found" },
        { status: 404 },
      );
    }

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
