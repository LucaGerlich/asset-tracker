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
import {
  isMaskedValue,
  MASKED_VALUE,
  partitionSettingKeys,
  settingsPayloadSchema,
} from "@/lib/settings-keys";

const ENCRYPTED_KEYS = ["sso.clientSecret"];

/**
 * GET /api/admin/settings/sso
 * Get SSO configuration settings
 */
export async function GET() {
  try {
    await requireSuperAdmin();

    // sso.token.* rows are short-lived login tokens, not configuration.
    const settings = await prisma.system_settings.findMany({
      where: {
        settingKey: {
          startsWith: "sso.",
        },
        NOT: { settingKey: { startsWith: "sso.token." } },
      },
    });

    const result = settings.map((s) => ({
      id: s.id,
      key: s.settingKey,
      value: s.isEncrypted ? MASKED_VALUE : s.settingValue,
      type: s.settingType,
      description: s.description,
      isEncrypted: s.isEncrypted,
    }));

    return NextResponse.json(result);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
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

    const user = await requireSuperAdmin();
    await requireWritableOrg(user);

    const parsed = settingsPayloadSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "settings array is required" },
        { status: 400 },
      );
    }

    const { rejected } = partitionSettingKeys(
      "sso",
      parsed.data.settings.map((setting) => setting.key),
    );
    if (rejected.length > 0) {
      return NextResponse.json(
        { error: "Unknown setting keys", keys: rejected },
        { status: 400 },
      );
    }

    // A masked value means "unchanged": never write the mask over a secret.
    const changes = parsed.data.settings.filter(
      (setting) => !isMaskedValue(setting.value),
    );

    await prisma.$transaction(
      changes.map((setting) => {
        const isSensitive = ENCRYPTED_KEYS.includes(setting.key);
        const storedValue =
          isSensitive && setting.value !== null
            ? encrypt(setting.value)
            : setting.value;

        return prisma.system_settings.upsert({
          where: { settingKey: setting.key },
          update: {
            settingValue: storedValue,
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
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("PUT /api/admin/settings/sso error", { error });
    return NextResponse.json(
      { error: "Failed to save SSO settings" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
