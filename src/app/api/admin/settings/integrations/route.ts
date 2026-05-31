import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSuperAdmin, requireNotDemoMode } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

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
      value: s.settingValue,
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
      settings.map((setting: { key: string; value: string }) =>
        prisma.system_settings.upsert({
          where: { settingKey: setting.key },
          update: {
            settingValue: setting.value,
            updatedAt: new Date(),
          },
          create: {
            settingKey: setting.key,
            settingValue: setting.value,
            settingType: "string",
            category: "integrations",
            isEncrypted: false,
            updatedAt: new Date(),
          },
        }),
      ),
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
