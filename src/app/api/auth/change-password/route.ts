import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { setUserPassword, verifyUserPassword } from "@/lib/auth-utils";
import { requireNotDemoMode } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { queueEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .max(128, "Password is too long"),
    confirmPassword: z.string().min(1, "Confirmation is required"),
    revokeOtherSessions: z.boolean().default(true),
    sendNotificationEmail: z.boolean().default(false),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirmation do not match",
    path: ["confirmPassword"],
  });

/**
 * POST /api/auth/change-password
 *
 * Self-service password change. Requires the user's current password as a
 * defense-in-depth measure against session-hijack attacks (an attacker with a
 * stolen session cookie cannot change the password without knowing the current one).
 *
 * Rate-limited per user to prevent brute-forcing the current password via this
 * endpoint.
 */
export async function POST(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    // Rate limit per user — protects the bcrypt.compare on currentPassword from
    // being used as a brute-force oracle.
    const rl = await checkRateLimit(`change-password:${userId}`, {
      maxRequests: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many password change attempts. Please try again later." },
        { status: 429 },
      );
    }

    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message || "Validation failed",
          details: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const {
      currentPassword,
      newPassword,
      revokeOtherSessions,
      sendNotificationEmail,
    } = parsed.data;

    // Verify current password against accounts.password (BetterAuth's source of truth)
    const currentValid = await verifyUserPassword(userId, currentPassword);
    if (!currentValid) {
      // Log failed attempt for security monitoring (successful changes are implicit signal)
      await createAuditLog({
        userId,
        action: AUDIT_ACTIONS.UPDATE,
        entity: AUDIT_ENTITIES.USER,
        entityId: userId,
        details: {
          reason: "password_change_failed",
          cause: "invalid_current_password",
        },
      });
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 403 },
      );
    }

    // Block reuse — we don't store password history, but we can detect "same as current"
    // without ever revealing what the previous password was.
    const sameAsCurrent = await verifyUserPassword(userId, newPassword);
    if (sameAsCurrent) {
      return NextResponse.json(
        { error: "New password must be different from your current password" },
        { status: 400 },
      );
    }

    // Atomically write new password to both user.password and accounts.password
    await setUserPassword(userId, newPassword);

    // Optionally revoke all OTHER sessions for this user. Keep the current session
    // alive so the user isn't logged out of the device they're using.
    if (revokeOtherSessions) {
      try {
        await prisma.sessions.deleteMany({
          where: {
            userId,
            NOT: { token: session.session.token },
          },
        });
      } catch (sessionErr) {
        // Don't fail the password change if session revocation fails — the password
        // is already changed. Log for diagnostics.
        logger.warn("Failed to revoke other sessions after password change", {
          userId,
          error: sessionErr,
        });
      }
    }

    // Optional notification email — fire-and-forget, queued via the existing pipeline
    if (sendNotificationEmail && session.user.email) {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "unknown";
      const userAgent = req.headers.get("user-agent") || "unknown";
      const subject = "Your Asset Tracker password was changed";
      const html = `
        <p>Hello ${session.user.name || ""},</p>
        <p>Your password was just changed.</p>
        <ul>
          <li><strong>When:</strong> ${new Date().toUTCString()}</li>
          <li><strong>IP address:</strong> ${ip}</li>
          <li><strong>Device:</strong> ${userAgent}</li>
        </ul>
        <p>If this was you, you can ignore this email. If you did not change your password, please reset it immediately and contact your administrator.</p>
      `;
      queueEmail(
        userId,
        "password_change",
        session.user.email,
        subject,
        html,
      ).catch((err) => {
        logger.warn("Failed to queue password change notification email", {
          userId,
          error: err,
        });
      });
    }

    await createAuditLog({
      userId,
      action: AUDIT_ACTIONS.UPDATE,
      entity: AUDIT_ENTITIES.USER,
      entityId: userId,
      details: {
        reason: "password_changed",
        revokeOtherSessions,
        sendNotificationEmail,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("POST /api/auth/change-password error", { error });
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
