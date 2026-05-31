import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth, requireNotDemoMode } from "@/lib/api-auth";
import { verifyMfaToken, generateBackupCodes } from "@/lib/mfa";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { decrypt, encryptArray } from "@/lib/encryption";
import { logger } from "@/lib/logger";

/**
 * POST /api/auth/mfa/verify
 *
 * Verifies the TOTP code during MFA setup (confirming the user scanned the QR
 * code correctly). On success, enables MFA on the user and returns one-time
 * backup codes. Custom logic includes encrypted backup code storage and audit
 * logging — not handled by BetterAuth's twoFactor plugin.
 *
 * BetterAuth equivalent: POST /api/auth/two-factor/verify-totp (partial overlap)
 * Note: Kept separate from BetterAuth's twoFactor plugin because this route
 * handles encrypted backup code storage and audit logging not covered by the plugin.
 */
export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const authUser = await requireApiAuth();

    if (!authUser.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { userid: authUser.id },
      select: { mfaSecret: true, mfaEnabled: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.mfaEnabled) {
      return NextResponse.json(
        { error: "MFA is already enabled" },
        { status: 400 },
      );
    }

    if (!user.mfaSecret) {
      return NextResponse.json(
        {
          error: "MFA setup has not been initiated. Please start setup first.",
        },
        { status: 400 },
      );
    }

    // Decrypt the secret before TOTP verification (handles legacy unencrypted data too)
    const isValid = verifyMfaToken(decrypt(user.mfaSecret), token);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 },
      );
    }

    // Generate backup codes and encrypt them before persisting
    const backupCodes = generateBackupCodes();

    // Enable MFA on the user — store encrypted backup codes in the database
    await prisma.user.update({
      where: { userid: authUser.id },
      data: {
        mfaEnabled: true,
        mfaBackupCodes: encryptArray(backupCodes),
      },
    });

    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.USER,
      entityId: authUser.id,
      details: { reason: "MFA enabled" },
    });

    // Return backup codes (shown only once)
    return NextResponse.json({
      success: true,
      backupCodes,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("POST /api/auth/mfa/verify error", { error });
    return NextResponse.json(
      { error: "Failed to verify MFA" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
