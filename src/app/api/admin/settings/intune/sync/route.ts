import { NextResponse } from "next/server";
import { requireSuperAdmin, requireWritableOrg } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { getOrganizationContext } from "@/lib/organization-context";
import { syncIntuneDevices } from "@/lib/integrations/intune";
import { triggerWebhook } from "@/lib/webhooks";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const user = await requireSuperAdmin();
    await requireWritableOrg(user);
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const result = await syncIntuneDevices(orgId, "manual");

    triggerWebhook(
      "intune.sync_completed",
      {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errorCount: result.errors.length,
      },
      orgId,
    ).catch(() => {});

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("POST /api/admin/settings/intune/sync error", { error });
    const message = error instanceof Error ? error.message : "Failed to sync";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
