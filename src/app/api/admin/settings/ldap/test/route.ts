import { NextResponse } from "next/server";
import { testConnection, getLdapSettings } from "@/lib/ldap";
import { requireNotDemoMode, requireSuperAdmin } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/settings/ldap/test
 * Test LDAP connection using saved settings.
 */
export async function POST() {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    await requireSuperAdmin();

    const settings = await getLdapSettings();

    if (!settings.serverUrl || !settings.bindDN || !settings.bindPassword) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Missing required LDAP settings. Please save settings first.",
        },
        { status: 400 },
      );
    }

    const result = await testConnection(settings);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("POST /api/admin/settings/ldap/test error", { error });
    return NextResponse.json(
      { success: false, message: "Test connection failed unexpectedly" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
