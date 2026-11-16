/**
 * Temporary Access Expiry Processing
 *
 * Handles automatic deactivation of users whose access has expired,
 * plus warning notifications at 7-day and 1-day thresholds.
 */

import prisma from "@/lib/prisma";
import { queueEmail } from "@/lib/email";
import { renderTemplate, emailTemplates } from "@/lib/email/templates";
import { logger } from "@/lib/logger";
import { reminderMarker, withMarker } from "@/lib/notifications";

interface ExpiryResult {
  expired: number;
  notified7d: number;
  notified1d: number;
}

export async function processAccessExpiry(): Promise<ExpiryResult> {
  const now = new Date();
  const in1Day = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let expired = 0;
  let notified7d = 0;
  let notified1d = 0;

  // 1. Deactivate expired users
  const expiredUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      accessExpiresAt: { not: null, lte: now },
    },
    select: {
      userid: true,
      firstname: true,
      lastname: true,
      email: true,
      organizationId: true,
      accessExpiresAt: true,
    },
  });

  for (const user of expiredUsers) {
    await prisma.user.update({
      where: { userid: user.userid },
      data: { isActive: false },
    });

    // Audit log (inline to avoid headers() dependency in cron context)
    await prisma.audit_logs.create({
      data: {
        userId: null,
        action: "EXPIRE",
        entity: "user",
        entityId: user.userid,
        details: JSON.stringify({
          reason: "access_expired",
          accessExpiresAt: user.accessExpiresAt?.toISOString(),
        }),
        ipAddress: "system",
        userAgent: "cron/access-expiry",
      },
    });

    if (user.email) {
      const html = renderTemplate(emailTemplates.accessExpired.html, {
        userName: `${user.firstname} ${user.lastname}`,
        expiryDate: user.accessExpiresAt?.toLocaleDateString() ?? "",
      });
      await queueEmail(
        user.userid,
        "access_expired",
        user.email,
        emailTemplates.accessExpired.subject,
        html,
      );
    }

    if (user.organizationId) {
      await notifyOrgAdmins(user.organizationId, user, "expired");
    }

    expired++;
  }

  // 2. Send 1-day warning (expires within 1 day but not yet expired)
  const expiringIn1Day = await prisma.user.findMany({
    where: {
      isActive: true,
      accessExpiresAt: { gt: now, lte: in1Day },
    },
    select: {
      userid: true,
      firstname: true,
      lastname: true,
      email: true,
      accessExpiresAt: true,
    },
  });

  for (const user of expiringIn1Day) {
    const marker = reminderMarker(user.userid, user.accessExpiresAt!);
    if (
      await hasRecentNotification(
        user.userid,
        "access_expiry_1d",
        marker,
        ONE_DAY_WARNING_WINDOW_MS,
      )
    ) {
      continue;
    }

    if (user.email) {
      const html = renderTemplate(emailTemplates.accessExpiry1Day.html, {
        userName: `${user.firstname} ${user.lastname}`,
        expiryDate: user.accessExpiresAt?.toLocaleDateString() ?? "",
      });
      await queueEmail(
        user.userid,
        "access_expiry_1d",
        user.email,
        emailTemplates.accessExpiry1Day.subject,
        withMarker(html, marker),
      );
    }
    notified1d++;
  }

  // 3. Send 7-day warning (expires within 7 days but more than 1 day away)
  const expiringIn7Days = await prisma.user.findMany({
    where: {
      isActive: true,
      accessExpiresAt: { gt: in1Day, lte: in7Days },
    },
    select: {
      userid: true,
      firstname: true,
      lastname: true,
      email: true,
      accessExpiresAt: true,
    },
  });

  for (const user of expiringIn7Days) {
    const marker = reminderMarker(user.userid, user.accessExpiresAt!);
    if (
      await hasRecentNotification(
        user.userid,
        "access_expiry_7d",
        marker,
        SEVEN_DAY_WARNING_WINDOW_MS,
      )
    ) {
      continue;
    }

    if (user.email) {
      const html = renderTemplate(emailTemplates.accessExpiry7Day.html, {
        userName: `${user.firstname} ${user.lastname}`,
        expiryDate: user.accessExpiresAt?.toLocaleDateString() ?? "",
      });
      await queueEmail(
        user.userid,
        "access_expiry_7d",
        user.email,
        emailTemplates.accessExpiry7Day.subject,
        withMarker(html, marker),
      );
    }
    notified7d++;
  }

  logger.info("Access expiry processing complete", {
    expired,
    notified7d,
    notified1d,
  });

  return { expired, notified7d, notified1d };
}

/**
 * Warning de-duplication windows. A warning is identified by user, type and
 * expiry date (see reminderMarker), so the window only has to outlast the band
 * of days in which the user is selected:
 * - 1-day band: one day wide; 30h also tolerates a cron run that fires early.
 * - 7-day band: six days wide (more than 1 day, up to 7 days away); the window
 *   covers the whole band so the warning goes out exactly once, not every
 *   other day as a 30h window did.
 */
const ONE_DAY_WARNING_WINDOW_MS = 30 * 60 * 60 * 1000;
const SEVEN_DAY_WARNING_WINDOW_MS = 8 * 24 * 60 * 60 * 1000;

async function hasRecentNotification(
  userId: string,
  type: string,
  marker: string,
  windowMs: number,
): Promise<boolean> {
  const existing = await prisma.notification_queue.findFirst({
    where: {
      userId,
      type,
      body: { contains: marker },
      createdAt: { gte: new Date(Date.now() - windowMs) },
    },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * Notify all admins in the same organization about an access expiry event.
 */
async function notifyOrgAdmins(
  organizationId: string,
  user: { firstname: string; lastname: string; accessExpiresAt: Date | null },
  event: "expired",
): Promise<void> {
  const admins = await prisma.user.findMany({
    where: {
      organizationId,
      isadmin: true,
      isActive: true,
      email: { not: null },
    },
    select: { userid: true, email: true },
  });

  const userName = `${user.firstname} ${user.lastname}`;
  const expiryDate = user.accessExpiresAt?.toLocaleDateString() ?? "";

  for (const admin of admins) {
    if (!admin.email) continue;
    const subject =
      event === "expired"
        ? `User Access Expired: ${userName}`
        : `User Access Expiring: ${userName}`;
    const body = `<p>The temporary access for <strong>${userName}</strong> has expired (${expiryDate}). Their account has been deactivated.</p>`;
    await queueEmail(
      admin.userid,
      "access_expiry_admin",
      admin.email,
      subject,
      body,
    );
  }
}
