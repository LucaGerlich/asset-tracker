import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getOrganizationContext } from "@/lib/organization-context";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { findAdminDemotionViolation } from "@/lib/admin-demotion";

// PATCH /api/admin/users/bulk-permissions
export async function PATCH(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAdmin();
    await requireWritableOrg(user);
    const body = await req.json();
    // The settings UI nests the fields under `updates`; flat bodies still work.
    const { userIds } = body;
    const { isadmin, canrequest } = body.updates ?? body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "userIds array is required and must not be empty" },
        { status: 400 },
      );
    }

    const updateData: {
      isadmin?: boolean;
      canrequest?: boolean;
      change_date?: Date;
    } = {};
    if (typeof isadmin === "boolean") {
      updateData.isadmin = isadmin;
    }
    if (typeof canrequest === "boolean") {
      updateData.canrequest = canrequest;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          error:
            "At least one permission field (isadmin or canrequest) is required",
        },
        { status: 400 },
      );
    }

    updateData.change_date = new Date();

    // Scope to admin's organization to prevent cross-tenant updates
    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;

    if (updateData.isadmin === false) {
      const violation = await findAdminDemotionViolation({
        callerId: user.id,
        targetUserIds: userIds,
        organizationId: orgId,
      });
      if (violation) {
        return NextResponse.json({ error: violation }, { status: 400 });
      }
    }

    const result = await prisma.user.updateMany({
      where: {
        userid: { in: userIds },
        organizationId: orgId ?? null,
      },
      data: updateData,
    });

    await createAuditLog({
      userId: user.id ?? null,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.USER,
      entityId: null,
      details: {
        type: "bulk_permission_update",
        userIds,
        changes: {
          ...(updateData.isadmin !== undefined && {
            isadmin: updateData.isadmin,
          }),
          ...(updateData.canrequest !== undefined && {
            canrequest: updateData.canrequest,
          }),
        },
        count: result.count,
      },
    });

    return NextResponse.json(
      {
        message: "Bulk permissions updated successfully",
        count: result.count,
      },
      { status: 200 },
    );
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("PATCH /api/admin/users/bulk-permissions error", { error });

    return NextResponse.json(
      { error: "Failed to update bulk permissions" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
