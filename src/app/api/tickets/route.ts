import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { createFreshdeskClient, SUPPORTED_TICKET_TYPES } from "@/lib/freshdesk";

/**
 * GET /api/tickets
 * Fetch tickets from Freshdesk (filtered to Hardware Request and Problem types)
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get Freshdesk configuration from database
    const [domainSetting, apiKeySetting] = await Promise.all([
      prisma.systemSettings.findUnique({
        where: { settingKey: "freshdesk_domain" },
      }),
      prisma.systemSettings.findUnique({
        where: { settingKey: "freshdesk_api_key" },
      }),
    ]);

    if (!domainSetting?.settingValue || !apiKeySetting?.settingValue) {
      return NextResponse.json(
        { error: "Freshdesk is not configured. Please configure it in Admin Settings." },
        { status: 400 }
      );
    }

    // Parse query params
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const typeFilter = url.searchParams.get("type"); // Optional: filter to specific type

    const client = createFreshdeskClient({
      domain: domainSetting.settingValue,
      apiKey: apiKeySetting.settingValue,
    });

    // Determine which types to filter
    const types = typeFilter
      ? [typeFilter]
      : [...SUPPORTED_TICKET_TYPES];

    const result = await client.getTicketsByTypes(types, page);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to fetch tickets" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      tickets: result.data || [],
      page,
      types: SUPPORTED_TICKET_TYPES,
    });
  } catch (error) {
    console.error("GET /api/tickets error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tickets" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
