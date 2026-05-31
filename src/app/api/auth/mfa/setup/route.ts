import { NextResponse } from "next/server";
import QRCode from "qrcode";
import prisma from "@/lib/prisma";
import { requireApiAuth, requireNotDemoMode } from "@/lib/api-auth";
import { generateMfaSecret, generateMfaUri } from "@/lib/mfa";
import { encrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";

/**
 * POST /api/auth/mfa/setup
 *
 * Custom MFA setup route — generates a TOTP secret, stores it encrypted in the
 * database, and returns a QR code. This is kept alongside BetterAuth's twoFactor
 * plugin because it provides custom logic: encrypted secret storage, QR code
 * generation via the `qrcode` library, and integration with our User model's
 * mfaEnabled / mfaSecret fields.
 *
 * BetterAuth equivalent: POST /api/auth/two-factor/enable
 * Note: Kept separate from BetterAuth's twoFactor plugin because this route
 * handles encrypted secret storage and QR code generation not covered by the plugin.
 */
export async function POST() {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const authUser = await requireApiAuth();

    if (!authUser.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { userid: authUser.id },
      select: { email: true, username: true, mfaEnabled: true },
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

    // Generate secret and store it temporarily (not enabled until verified)
    const secret = generateMfaSecret();
    const identifier = user.email || user.username || authUser.id;
    const uri = generateMfaUri(secret, identifier);

    // Store the secret on the user (mfaEnabled remains false until verification)
    // Encrypt the secret before persisting to the database.
    await prisma.user.update({
      where: { userid: authUser.id },
      data: { mfaSecret: encrypt(secret) },
    });

    // Generate QR code as data URI
    const qrCodeDataUri = await QRCode.toDataURL(uri);

    return NextResponse.json({
      secret,
      qrCode: qrCodeDataUri,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("POST /api/auth/mfa/setup error", { error });
    return NextResponse.json({ error: "Failed to setup MFA" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
