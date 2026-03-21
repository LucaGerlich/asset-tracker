import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { requireNotDemoMode, requireApiAdmin } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    await requireApiAdmin();

    const body = await req.json();
    const {
      provider,
      apiKey,
      fromEmail,
      fromName,
      domain,
      region,
      accessKeyId,
      secretAccessKey,
    } = body;

    // Upsert email settings
    const settingsToUpsert = [
      {
        key: "email_provider",
        value: provider,
        type: "string",
        category: "email",
      },
      {
        key: "email_from",
        value: fromEmail,
        type: "string",
        category: "email",
      },
      {
        key: "email_from_name",
        value: fromName || "Asset Tracker",
        type: "string",
        category: "email",
      },
    ];

    if (apiKey) {
      settingsToUpsert.push({
        key: "email_api_key",
        value: apiKey,
        type: "string",
        category: "email",
      });
    }

    if (domain) {
      settingsToUpsert.push({
        key: "email_domain",
        value: domain,
        type: "string",
        category: "email",
      });
    }

    if (region) {
      settingsToUpsert.push({
        key: "email_region",
        value: region,
        type: "string",
        category: "email",
      });
    }

    if (accessKeyId) {
      settingsToUpsert.push({
        key: "email_access_key_id",
        value: accessKeyId,
        type: "string",
        category: "email",
      });
    }

    if (secretAccessKey) {
      settingsToUpsert.push({
        key: "email_secret_access_key",
        value: secretAccessKey,
        type: "string",
        category: "email",
      });
    }

    for (const setting of settingsToUpsert) {
      const isSensitive =
        setting.key.includes("api_key") || setting.key.includes("secret");
      const storedValue = isSensitive ? encrypt(setting.value) : setting.value;

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
          isEncrypted: isSensitive,
          updatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("POST /api/admin/settings/email error", { error });
    return NextResponse.json(
      { error: "Failed to save email settings" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
