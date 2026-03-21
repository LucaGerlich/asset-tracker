import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { requireNotDemoMode, requireApiAdmin } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

/**
 * GET /api/admin/settings/sso
 * Get SSO configuration settings
 */
export async function GET() {
  try {
    await requireApiAdmin();

    const settings = await prisma.system_settings.findMany({
      where: {
        settingKey: {
          startsWith: "sso.",
        },
      },
    });

    const result = settings.map((s) => ({
      id: s.id,
      key: s.settingKey,
      value: s.isEncrypted ? "********" : s.settingValue,
      type: s.settingType,
      description: s.description,
      isEncrypted: s.isEncrypted,
    }));

    return NextResponse.json(result);
  } catch (error) {
    logger.error("GET /api/admin/settings/sso error", { error });
    return NextResponse.json(
      { error: "Failed to get SSO settings" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/settings/sso
 * Save SSO configuration settings
 */
export async function PUT(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    await requireApiAdmin();

    const body = await req.json();
    const { settings } = body;

    if (!Array.isArray(settings)) {
      return NextResponse.json(
        { error: "settings array is required" },
        { status: 400 },
      );
    }

    const encryptedKeys = ["sso.clientSecret"];

    await prisma.$transaction(
      settings.map((setting: { key: string; value: string }) => {
        const isSensitive = encryptedKeys.includes(setting.key);
        const isUnchanged = setting.value === "********";
        const storedValue = isUnchanged
          ? setting.value
          : isSensitive
            ? encrypt(setting.value)
            : setting.value;

        return prisma.system_settings.upsert({
          where: { settingKey: setting.key },
          update: {
            settingValue: isUnchanged ? undefined : storedValue,
            updatedAt: new Date(),
          },
          create: {
            settingKey: setting.key,
            settingValue: storedValue,
            settingType: "string",
            category: "sso",
            isEncrypted: isSensitive,
            updatedAt: new Date(),
          },
        });
      }),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("PUT /api/admin/settings/sso error", { error });
    return NextResponse.json(
      { error: "Failed to save SSO settings" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
