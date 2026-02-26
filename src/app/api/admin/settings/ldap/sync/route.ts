import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { syncUsers } from "@/lib/ldap";
import { requireNotDemoMode } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/settings/ldap/sync
 * Trigger a manual LDAP user sync.
 */
export async function POST() {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId || undefined;
    const result = await syncUsers(organizationId, "manual");

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    logger.error("POST /api/admin/settings/ldap/sync error", { error });
    return NextResponse.json(
      { success: false, error: "Sync failed unexpectedly" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
