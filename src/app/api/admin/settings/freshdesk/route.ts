import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { createFreshdeskClient } from "@/lib/freshdesk";

/**
 * GET /api/admin/settings/freshdesk
 * Get current Freshdesk configuration (without exposing API key)
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await prisma.systemSettings.findMany({
      where: {
        settingKey: {
          startsWith: "freshdesk_",
        },
      },
    });

    const config: Record<string, string | null> = {};
    for (const setting of settings) {
      const key = setting.settingKey.replace("freshdesk_", "");
      // Mask API key for security
      if (key === "api_key" && setting.settingValue) {
        config[key] = "********";
      } else {
        config[key] = setting.settingValue;
      }
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error("GET /api/admin/settings/freshdesk error:", error);
    return NextResponse.json(
      { error: "Failed to get Freshdesk settings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/settings/freshdesk
 * Save Freshdesk configuration
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { domain, apiKey } = body;

    if (!domain) {
      return NextResponse.json(
        { error: "Freshdesk domain is required" },
        { status: 400 }
      );
    }

    // Upsert Freshdesk settings
    const settingsToUpsert = [
      {
        key: "freshdesk_domain",
        value: domain,
        type: "string",
        category: "freshdesk",
        description: "Freshdesk subdomain (e.g., 'yourcompany' for yourcompany.freshdesk.com)",
        isEncrypted: false,
      },
    ];

    // Only update API key if provided (not masked value)
    if (apiKey && apiKey !== "********") {
      settingsToUpsert.push({
        key: "freshdesk_api_key",
        value: apiKey,
        type: "string",
        category: "freshdesk",
        description: "Freshdesk API key for authentication",
        isEncrypted: true,
      });
    }

    for (const setting of settingsToUpsert) {
      await prisma.systemSettings.upsert({
        where: { settingKey: setting.key },
        update: {
          settingValue: setting.value,
          updatedAt: new Date(),
        },
        create: {
          settingKey: setting.key,
          settingValue: setting.value,
          settingType: setting.type,
          category: setting.category,
          description: setting.description,
          isEncrypted: setting.isEncrypted,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/admin/settings/freshdesk error:", error);
    return NextResponse.json(
      { error: "Failed to save Freshdesk settings" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
