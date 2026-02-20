import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyMfaToken, verifyBackupCode } from "@/lib/mfa";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { decrypt, decryptArray, encryptArray } from "@/lib/encryption";
import {
  checkRateLimit,
  getClientIP,
  createRateLimitResponse,
} from "@/lib/rate-limit";

/**
 * POST /api/auth/mfa/validate
 * Validate MFA token during login flow (2nd step).
 * Does NOT require auth — user is mid-login with mfaPending.
 */
export async function POST(req: Request) {
  try {
    // Rate limit: 5 MFA attempts per 15 min per IP
    const ip = getClientIP(req);
    const ipRl = checkRateLimit(`mfa:${ip}`, {
      maxRequests: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!ipRl.success) {
      return createRateLimitResponse(
        ipRl,
        "Too many MFA attempts. Please try again later.",
      );
    }

    const { token, isBackupCode, pendingUserId } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    if (!pendingUserId || typeof pendingUserId !== "string") {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    // Rate limit: 5 MFA attempts per 15 min per user
    const userRl = checkRateLimit(`mfa:user:${pendingUserId}`, {
      maxRequests: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!userRl.success) {
      return createRateLimitResponse(
        userRl,
        "Too many MFA attempts for this account. Please try again later.",
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
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    let isValid = false;

    // Decrypt the stored secret and backup codes (handles legacy unencrypted data too)
    const decryptedSecret = decrypt(user.mfaSecret);
    const decryptedBackupCodes = decryptArray(user.mfaBackupCodes);

    if (isBackupCode) {
      // Verify backup code against decrypted codes
      const result = verifyBackupCode(decryptedBackupCodes, token);
      isValid = result.valid;

      if (isValid) {
        // Re-encrypt the remaining backup codes and persist
        await prisma.user.update({
          where: { userid: user.userid },
          data: { mfaBackupCodes: encryptArray(result.remainingCodes) },
        });
      }
    } else {
      // Verify TOTP token against decrypted secret
      isValid = verifyMfaToken(decryptedSecret, token);
    }

    if (!isValid) {
      await createAuditLog({
        userId: user.userid,
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        entity: AUDIT_ENTITIES.USER,
        entityId: user.userid,
        details: {
          username: user.username,
          reason: isBackupCode
            ? "Invalid MFA backup code"
            : "Invalid MFA token",
        },
      });

      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 },
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
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
