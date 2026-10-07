import { NextResponse } from "next/server";
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { getGDPRSettings, saveGDPRSettings } from "@/lib/gdpr-settings";
import { logger } from "@/lib/logger";

/**
 * GET /api/admin/gdpr/retention
 * Returns current GDPR retention settings (or defaults if none exist).
 */
export async function GET() {
  try {
    await requireApiAdmin();
    const settings = getGDPRSettings();
    return NextResponse.json(settings);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("GET /api/admin/gdpr/retention error", { error });
    return NextResponse.json(
      { error: "Failed to get retention settings" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/gdpr/retention
 * Updates GDPR retention settings.
 */
export async function PUT(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAdmin();
    await requireWritableOrg(user);
    const body = await req.json();

    const {
      auditLogRetentionDays,
      deletedUserRetentionDays,
      exportRetentionDays,
    } = body;

    if (
      typeof auditLogRetentionDays !== "number" ||
      typeof deletedUserRetentionDays !== "number" ||
      typeof exportRetentionDays !== "number"
    ) {
      return NextResponse.json(
        { error: "All retention values must be numbers" },
        { status: 400 },
      );
    }

    if (
      auditLogRetentionDays < 1 ||
      deletedUserRetentionDays < 1 ||
      exportRetentionDays < 1
    ) {
      return NextResponse.json(
        { error: "Retention values must be at least 1 day" },
        { status: 400 },
      );
    }

    const updated = saveGDPRSettings({
      auditLogRetentionDays,
      deletedUserRetentionDays,
      exportRetentionDays,
    });

    return NextResponse.json(updated);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("PUT /api/admin/gdpr/retention error", { error });
    return NextResponse.json(
      { error: "Failed to update retention settings" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
