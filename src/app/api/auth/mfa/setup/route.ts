import { NextResponse } from "next/server";
import QRCode from "qrcode";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { generateMfaSecret, generateMfaUri } from "@/lib/mfa";

export async function POST() {
  try {
    const authUser = await requireApiAuth();

    if (!authUser.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user email for the TOTP URI
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
        { status: 400 }
      );
    }

    // Generate secret and store it temporarily (not enabled until verified)
    const secret = generateMfaSecret();
    const identifier = user.email || user.username || authUser.id;
    const uri = generateMfaUri(secret, identifier);

    // Store the secret on the user (mfaEnabled remains false until verification)
    await prisma.user.update({
      where: { userid: authUser.id },
      data: { mfaSecret: secret },
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
    console.error("POST /api/auth/mfa/setup error:", error);
    return NextResponse.json(
      { error: "Failed to setup MFA" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
