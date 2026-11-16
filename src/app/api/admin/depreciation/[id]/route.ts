import { NextRequest, NextResponse } from "next/server";
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import { getOrganizationContext } from "@/lib/organization-context";
import prisma from "@/lib/prisma";
import {
  updateDepreciationSettingsSchema,
  uuidSchema,
  validateBody,
} from "@/lib/validation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/admin/depreciation/[id]
// Depreciation settings hang off an asset category, which carries the
// organization, so ownership is resolved through that relation.
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const admin = await requireApiAdmin();
    await requireWritableOrg(admin);

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const validated = validateBody(updateDepreciationSettingsSchema, body);
    if (validated instanceof NextResponse) return validated;

    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const existing = await prisma.depreciation_settings.findFirst({
      where: { id, assetCategoryType: { organizationId: orgId ?? null } },
      select: { id: true, categoryId: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Depreciation settings not found" },
        { status: 404 },
      );
    }

    const updated = await prisma.depreciation_settings.update({
      where: { id },
      data: { ...validated, updatedAt: new Date() },
    });

    await createAuditLog({
      userId: admin.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.DEPRECIATION_SETTINGS,
      entityId: id,
      details: { categoryId: existing.categoryId, ...validated },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    const denied = apiErrorResponse(e);
    if (denied) return denied;
    logger.error("PUT /api/admin/depreciation/[id] error", { error: e });

    return NextResponse.json(
      { error: "Failed to update depreciation settings" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
