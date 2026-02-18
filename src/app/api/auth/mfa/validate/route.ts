import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyMfaToken, verifyBackupCode } from "@/lib/mfa";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";

/**
 * POST /api/auth/mfa/validate
 * Validate MFA token during login flow (2nd step).
 * Does NOT require auth — user is mid-login with mfaPending.
 */
export async function POST(req: Request) {
  try {
    const { token, isBackupCode, pendingUserId } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    if (!pendingUserId || typeof pendingUserId !== "string") {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { userid: pendingUserId },
      select: {
        userid: true,
        username: true,
        mfaEnabled: true,
        mfaSecret: true,
        mfaBackupCodes: true,
      },
    });

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      );
    }

    let isValid = false;

    if (isBackupCode) {
      // Verify backup code
      const result = verifyBackupCode(user.mfaBackupCodes, token);
      isValid = result.valid;

      if (isValid) {
        // Remove used backup code
        await prisma.user.update({
          where: { userid: user.userid },
          data: { mfaBackupCodes: result.remainingCodes },
        });
      }
    } else {
      // Verify TOTP token
      isValid = verifyMfaToken(user.mfaSecret, token);
    }

    if (!isValid) {
      await createAuditLog({
        userId: user.userid,
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        entity: AUDIT_ENTITIES.USER,
        entityId: user.userid,
        details: {
          username: user.username,
          reason: isBackupCode ? "Invalid MFA backup code" : "Invalid MFA token",
        },
      });

      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // MFA validation successful
    await createAuditLog({
      userId: user.userid,
      action: AUDIT_ACTIONS.LOGIN,
      entity: AUDIT_ENTITIES.USER,
      entityId: user.userid,
      details: {
        username: user.username,
        mfaMethod: isBackupCode ? "backup_code" : "totp",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/auth/mfa/validate error:", error);
    return NextResponse.json(
      { error: "Failed to validate MFA" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
