import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { createFreshdeskClient } from "@/lib/freshdesk";
import { decrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/settings/freshdesk/test
 * Test Freshdesk API connection
 */
export async function POST(req: Request) {
  try {
    await requireSuperAdmin();

    const body = await req.json();
    let { domain, apiKey } = body;

    // If API key is masked, get the stored one and decrypt it
    if (apiKey === "********" || !apiKey) {
      const storedApiKey = await prisma.system_settings.findUnique({
        where: { settingKey: "freshdesk_api_key" },
      });
      apiKey = storedApiKey?.settingValue
        ? decrypt(storedApiKey.settingValue)
        : undefined;
    }

    if (!domain || !apiKey) {
      return NextResponse.json(
        { error: "Freshdesk domain and API key are required" },
        { status: 400 },
      );
    }

    const client = createFreshdeskClient({ domain, apiKey });
    const isConnected = await client.testConnection();

    if (isConnected) {
      return NextResponse.json({
        success: true,
        message: "Connection successful",
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error:
            "Failed to connect to Freshdesk. Please check your credentials.",
        },
        { status: 400 },
      );
    }
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("POST /api/admin/settings/freshdesk/test error", { error });
    return NextResponse.json(
      { success: false, error: "Connection test failed" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
