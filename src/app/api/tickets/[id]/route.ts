import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { createFreshdeskClient } from "@/lib/freshdesk";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tickets/[id]
 * Fetch a single ticket from Freshdesk
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const ticketId = parseInt(id, 10);

    if (isNaN(ticketId)) {
      return NextResponse.json(
        { error: "Invalid ticket ID" },
        { status: 400 }
      );
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

    const client = createFreshdeskClient({
      domain: domainSetting.settingValue,
      apiKey: apiKeySetting.settingValue,
    });

    const result = await client.getTicket(ticketId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to fetch ticket" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ticket: result.data });
  } catch (error) {
    console.error("GET /api/tickets/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ticket" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
