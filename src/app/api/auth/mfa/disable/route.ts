import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth, requireNotDemoMode } from "@/lib/api-auth";
import { verifyUserPassword } from "@/lib/auth-utils";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { logger } from "@/lib/logger";

/**
 * POST /api/auth/mfa/disable
 *
 * Disables MFA for the authenticated user after verifying their password.
 * Custom logic: password re-verification via bcrypt, clearing encrypted MFA
 * secrets and backup codes, and audit logging — not handled by BetterAuth's
 * twoFactor plugin.
 *
 * BetterAuth equivalent: POST /api/auth/two-factor/disable (partial overlap)
 * Note: Kept separate from BetterAuth's twoFactor plugin because this route
 * handles encrypted secret clearing and audit logging not covered by the plugin.
 */
export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const authUser = await requireApiAuth();

    if (!authUser.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { password } = await req.json();

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password is required to disable MFA" },
        { status: 400 },
      );
    }

    // Check MFA is currently enabled before bothering with password verification
    const user = await prisma.user.findUnique({
      where: { userid: authUser.id },
      select: { mfaEnabled: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.mfaEnabled) {
      return NextResponse.json(
        { error: "MFA is not enabled" },
        { status: 400 },
      );
    }

    // Verify password against accounts.password (BetterAuth's source of truth) — using
    // user.password here was a bug because that column can be stale relative to accounts.
    const isValidPassword = await verifyUserPassword(authUser.id, password);

    if (!isValidPassword) {
      return NextResponse.json({ error: "Invalid password" }, { status: 403 });
    }

    // Disable MFA
    await prisma.user.update({
      where: { userid: authUser.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: [],
      },
    });

    await createAuditLog({
      userId: authUser.id,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.USER,
      entityId: authUser.id,
      details: { reason: "MFA disabled" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("POST /api/auth/mfa/disable error", { error });
    return NextResponse.json(
      { error: "Failed to disable MFA" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
