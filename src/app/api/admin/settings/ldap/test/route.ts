import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { testConnection, getLdapSettings } from "@/lib/ldap";
import { requireNotDemoMode } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/settings/ldap/test
 * Test LDAP connection using saved settings.
 */
export async function POST() {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await getLdapSettings();

    if (!settings.serverUrl || !settings.bindDN || !settings.bindPassword) {
      return NextResponse.json(
        { success: false, message: "Missing required LDAP settings. Please save settings first." },
        { status: 400 },
      );
    }

    const result = await testConnection(settings);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    logger.error("POST /api/admin/settings/ldap/test error", { error });
    return NextResponse.json(
      { success: false, message: "Test connection failed unexpectedly" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
