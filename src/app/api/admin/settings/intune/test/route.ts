import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { testIntuneConnection } from "@/lib/integrations/intune";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    await requireSuperAdmin();

    const result = await testIntuneConnection();

    return NextResponse.json(result);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("POST /api/admin/settings/intune/test error", { error });
    return NextResponse.json(
      { success: false, message: "Failed to test connection" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
