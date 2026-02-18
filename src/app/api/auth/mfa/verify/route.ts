import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { verifyMfaToken, generateBackupCodes } from "@/lib/mfa";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";

export async function POST(req: Request) {
  try {
    const authUser = await requireApiAuth();

    if (!authUser.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // Get user's pending MFA secret
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
        { status: 400 }
      );
    }

    if (!user.mfaSecret) {
      return NextResponse.json(
        { error: "MFA setup has not been initiated. Please start setup first." },
        { status: 400 }
      );
    }

    // Verify the TOTP token against the stored secret
    const isValid = verifyMfaToken(user.mfaSecret, token);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes();

    // Enable MFA on the user
    await prisma.user.update({
      where: { userid: authUser.id },
      data: {
        mfaEnabled: true,
        mfaBackupCodes: backupCodes,
      },
    });

    // Audit log
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
    console.error("POST /api/auth/mfa/verify error:", error);
    return NextResponse.json(
      { error: "Failed to verify MFA" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
