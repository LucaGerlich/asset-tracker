import { NextResponse } from "next/server";
import { syncUsers } from "@/lib/ldap";
import {
  requireNotDemoMode,
  requireSuperAdmin,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/settings/ldap/sync
 * Trigger a manual LDAP user sync.
 */
export async function POST() {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const superAdmin = await requireSuperAdmin();
    await requireWritableOrg(superAdmin);

    const organizationId = superAdmin.organizationId || undefined;
    const result = await syncUsers(organizationId, "manual");

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("POST /api/admin/settings/ldap/sync error", { error });
    return NextResponse.json(
      { success: false, error: "Sync failed unexpectedly" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
