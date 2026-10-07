import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import {
  requireNotDemoMode,
  requireSuperAdmin,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    await requireSuperAdmin();

    const settings = await prisma.system_settings.findMany({
      where: { settingKey: { startsWith: "intune." } },
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
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("GET /api/admin/settings/intune error", { error });
    return NextResponse.json(
      { error: "Failed to get Intune settings" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireSuperAdmin();
    await requireWritableOrg(user);

    const body = await req.json();
    const { settings } = body;

    if (!Array.isArray(settings)) {
      return NextResponse.json(
        { error: "settings array is required" },
        { status: 400 },
      );
    }

    const encryptedKeys = ["intune.clientSecret"];

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
            category: "intune",
            isEncrypted: isSensitive,
            updatedAt: new Date(),
          },
        });
      }),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("PUT /api/admin/settings/intune error", { error });
    return NextResponse.json(
      { error: "Failed to save Intune settings" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
