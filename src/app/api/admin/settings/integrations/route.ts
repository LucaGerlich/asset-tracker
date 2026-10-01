import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { requireSuperAdmin, requireNotDemoMode } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

// Webhook URLs are secrets in effect (possession lets you receive/spoof
// notifications), so they're stored encrypted and masked on read, mirroring
// the LDAP settings route.
const ENCRYPTED_KEYS = [
  "integrations.slack.webhookUrl",
  "integrations.teams.webhookUrl",
];

export async function GET() {
  try {
    await requireSuperAdmin();

    const settings = await prisma.system_settings.findMany({
      where: {
        settingKey: { startsWith: "integrations." },
      },
    });

    const result = settings.map((s) => ({
      id: s.id,
      key: s.settingKey,
      value: s.isEncrypted ? "********" : s.settingValue,
    }));

    return NextResponse.json(result);
  } catch (error) {
    logger.error("GET /api/admin/settings/integrations error", { error });
    return NextResponse.json(
      { error: "Failed to get integration settings" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    await requireSuperAdmin();

    const body = await req.json();
    const { settings } = body;

    if (!Array.isArray(settings)) {
      return NextResponse.json(
        { error: "settings array is required" },
        { status: 400 },
      );
    }

    await prisma.$transaction(
      settings.map((setting: { key: string; value: string }) => {
        const isSensitive = ENCRYPTED_KEYS.includes(setting.key);
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
            category: "integrations",
            isEncrypted: isSensitive,
            updatedAt: new Date(),
          },
        });
      }),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("PUT /api/admin/settings/integrations error", { error });
    return NextResponse.json(
      { error: "Failed to save integration settings" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
