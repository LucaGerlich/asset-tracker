import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireApiAdmin,
  requireApiAuth,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { scopeToOrganization } from "@/lib/organization-context";
import { updateStockAlertSchema } from "@/lib/validation-organization";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * An alert is reachable only through its consumable's organization. Callers
 * look alerts up with this filter and answer 404 on a miss, so an alert of
 * another org can be neither read nor changed nor deleted by ID.
 */
function ownAlertWhere(id: string, organizationId: string | undefined) {
  return {
    id,
    consumable: scopeToOrganization({}, organizationId),
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await requireApiAuth();

    const alert = await prisma.stockAlert.findFirst({
      where: ownAlertWhere(id, user.organizationId),
      include: {
        consumable: {
          select: {
            consumableid: true,
            consumablename: true,
            quantity: true,
            minQuantity: true,
          },
        },
      },
    });

    if (!alert) {
      return NextResponse.json(
        { error: "Stock alert not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(alert);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error fetching stock alert", { error });
    return NextResponse.json(
      { error: "Failed to fetch stock alert" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const { id } = await params;
    const user = await requireApiAdmin();
    await requireWritableOrg(user);

    const body = await req.json();
    const validated = updateStockAlertSchema.parse(body);

    const existingAlert = await prisma.stockAlert.findFirst({
      where: ownAlertWhere(id, user.organizationId),
    });

    if (!existingAlert) {
      return NextResponse.json(
        { error: "Stock alert not found" },
        { status: 404 },
      );
    }

    const minThreshold = validated.minThreshold ?? existingAlert.minThreshold;
    const criticalThreshold =
      validated.criticalThreshold ?? existingAlert.criticalThreshold;

    if (criticalThreshold > minThreshold) {
      return NextResponse.json(
        {
          error:
            "Critical threshold must be less than or equal to minimum threshold",
        },
        { status: 400 },
      );
    }

    const alert = await prisma.stockAlert.update({
      where: { id },
      data: {
        ...validated,
        updatedAt: new Date(),
      },
    });

    await createAuditLog({
      userId: user.id!,
      action: AUDIT_ACTIONS.UPDATE,
      entity: "StockAlert",
      entityId: alert.id,
      details: validated as Record<string, unknown>,
    });

    return NextResponse.json(alert);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error updating stock alert", { error });
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to update stock alert" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const { id } = await params;
    const user = await requireApiAdmin();
    await requireWritableOrg(user);

    const alert = await prisma.stockAlert.findFirst({
      where: ownAlertWhere(id, user.organizationId),
      include: {
        consumable: { select: { consumablename: true } },
      },
    });

    if (!alert) {
      return NextResponse.json(
        { error: "Stock alert not found" },
        { status: 404 },
      );
    }

    await prisma.stockAlert.delete({
      where: { id },
    });

    await createAuditLog({
      userId: user.id!,
      action: AUDIT_ACTIONS.DELETE,
      entity: "StockAlert",
      entityId: id,
      details: { consumableName: alert.consumable.consumablename },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Error deleting stock alert", { error });
    return NextResponse.json(
      { error: "Failed to delete stock alert" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
