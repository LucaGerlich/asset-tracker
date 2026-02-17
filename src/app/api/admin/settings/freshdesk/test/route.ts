import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { createFreshdeskClient } from "@/lib/freshdesk";

/**
 * POST /api/admin/settings/freshdesk/test
 * Test Freshdesk API connection
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    let { domain, apiKey } = body;

    // If API key is masked, get the stored one
    if (apiKey === "********" || !apiKey) {
      const storedApiKey = await prisma.systemSettings.findUnique({
        where: { settingKey: "freshdesk_api_key" },
      });
      apiKey = storedApiKey?.settingValue;
    }

    if (!domain || !apiKey) {
      return NextResponse.json(
        { error: "Freshdesk domain and API key are required" },
        { status: 400 }
      );
    }

    const client = createFreshdeskClient({ domain, apiKey });
    const isConnected = await client.testConnection();

    if (isConnected) {
      return NextResponse.json({ success: true, message: "Connection successful" });
    } else {
      return NextResponse.json(
        { success: false, error: "Failed to connect to Freshdesk. Please check your credentials." },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("POST /api/admin/settings/freshdesk/test error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Connection test failed" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
