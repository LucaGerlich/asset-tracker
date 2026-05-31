import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { requireNotDemoMode, requireSuperAdmin } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

/**
 * GET /api/admin/settings/freshdesk
 * Get current Freshdesk configuration (without exposing API key)
 */
export async function GET() {
  try {
    await requireSuperAdmin();

    const settings = await prisma.system_settings.findMany({
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
    logger.error("GET /api/admin/settings/freshdesk error", { error });
    return NextResponse.json(
      { error: "Failed to get Freshdesk settings" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/settings/freshdesk
 * Save Freshdesk configuration
 */
export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    await requireSuperAdmin();

    const body = await req.json();
    const { domain, apiKey } = body;

    if (!domain) {
      return NextResponse.json(
        { error: "Freshdesk domain is required" },
        { status: 400 },
      );
    }

    // Upsert Freshdesk settings
    const settingsToUpsert = [
      {
        key: "freshdesk_domain",
        value: domain,
        type: "string",
        category: "freshdesk",
        description:
          "Freshdesk subdomain (e.g., 'yourcompany' for yourcompany.freshdesk.com)",
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
      // Encrypt sensitive settings (e.g. API keys) before persisting
      const storedValue = setting.isEncrypted
        ? encrypt(setting.value)
        : setting.value;

      await prisma.system_settings.upsert({
        where: { settingKey: setting.key },
        update: {
          settingValue: storedValue,
          updatedAt: new Date(),
        },
        create: {
          settingKey: setting.key,
          settingValue: storedValue,
          settingType: setting.type,
          category: setting.category,
          description: setting.description,
          isEncrypted: setting.isEncrypted,
          updatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("POST /api/admin/settings/freshdesk error", { error });
    return NextResponse.json(
      { error: "Failed to save Freshdesk settings" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
