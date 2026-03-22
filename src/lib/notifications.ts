/**
 * Notification Service
 * Handles sending notifications for various events
 */

import prisma from "./prisma";
import { queueEmail, emailTemplates, renderTemplate } from "./email";

interface AssetNotificationData {
  assetId: string;
  assetName: string;
  assetTag: string;
  serialNumber?: string;
}

interface UserNotificationData {
  userId: string;
  userName: string;
  userEmail: string;
}

/**
 * Send asset assignment notification
 */
export async function notifyAssetAssignment(
  asset: AssetNotificationData,
  user: UserNotificationData,
): Promise<void> {
  const prefs = await getUserNotificationPrefs(user.userId);
  if (!prefs?.emailAssignments) return;

  const template = emailTemplates.assetAssignment;
  const html = renderTemplate(template.html, {
    userName: user.userName,
    assetName: asset.assetName,
    assetTag: asset.assetTag,
    serialNumber: asset.serialNumber || "N/A",
    assignedDate: new Date().toLocaleDateString(),
  });

  const subject = renderTemplate(template.subject, {
    assetName: asset.assetName,
  });

  await queueEmail(user.userId, "assignment", user.userEmail, subject, html);
}

/**
 * Send asset unassignment notification
 */
export async function notifyAssetUnassignment(
  asset: AssetNotificationData,
  user: UserNotificationData,
): Promise<void> {
  const prefs = await getUserNotificationPrefs(user.userId);
  if (!prefs?.emailUnassignments) return;

  const template = emailTemplates.assetUnassignment;
  const html = renderTemplate(template.html, {
    userName: user.userName,
    assetName: asset.assetName,
    assetTag: asset.assetTag,
    unassignedDate: new Date().toLocaleDateString(),
  });

  const subject = renderTemplate(template.subject, {
    assetName: asset.assetName,
  });

  await queueEmail(user.userId, "unassignment", user.userEmail, subject, html);
}

/**
 * Notify all admins about a new reservation request
 */
export async function notifyReservationRequest(reservation: {
  assetName: string;
  assetTag: string;
  requesterName: string;
  startDate: string;
  endDate: string;
  notes: string | null;
}): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { isadmin: true },
  });

  const template = emailTemplates.reservationRequest;
  const subject = renderTemplate(template.subject, {
    assetName: reservation.assetName,
  });
  const html = renderTemplate(template.html, {
    requesterName: reservation.requesterName,
    assetName: reservation.assetName,
    assetTag: reservation.assetTag,
    startDate: reservation.startDate,
    endDate: reservation.endDate,
    notes: reservation.notes || "None",
  });

  for (const admin of admins) {
    if (!admin.email) continue;
    await queueEmail(
      admin.userid,
      "reservation_request",
      admin.email,
      subject,
      html,
    );
  }
}

/**
 * Notify the requester about their reservation approval or rejection
 */
export async function notifyReservationDecision(decision: {
  assetName: string;
  assetTag: string;
  userName: string;
  userEmail: string;
  userId: string;
  startDate: string;
  endDate: string;
  status: "approved" | "rejected";
  approverName: string;
  notes: string | null;
}): Promise<void> {
  const template =
    decision.status === "approved"
      ? emailTemplates.reservationApproved
      : emailTemplates.reservationRejected;

  const subject = renderTemplate(template.subject, {
    assetName: decision.assetName,
  });
  const html = renderTemplate(template.html, {
    userName: decision.userName,
    assetName: decision.assetName,
    assetTag: decision.assetTag,
    startDate: decision.startDate,
    endDate: decision.endDate,
    approverName: decision.approverName,
    notes: decision.notes || "No reason provided",
  });

  await queueEmail(
    decision.userId,
    `reservation_${decision.status}`,
    decision.userEmail,
    subject,
    html,
  );
}

/**
 * Check and notify about expiring licenses
 */
export async function checkExpiringLicenses(): Promise<number> {
  const defaultDays = 30;

  // Get all licenses expiring within the notification window
  const now = new Date();
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + defaultDays);

  const expiringLicenses = await prisma.licence.findMany({
    where: {
      expirationdate: {
        gte: now,
        lte: maxDate,
      },
      licenceduserid: { not: null },
    },
    include: {
      user: true,
      licenceCategoryType: true,
    },
  });

  let notified = 0;

  for (const license of expiringLicenses) {
    if (!license.user?.email) continue;

    const prefs = await getUserNotificationPrefs(license.user.userid);
    if (!prefs?.emailLicenseExpiry) continue;

    const daysRemaining = Math.ceil(
      (new Date(license.expirationdate!).getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    const template = emailTemplates.licenseExpiring;
    const html = renderTemplate(template.html, {
      userName: `${license.user.firstname} ${license.user.lastname}`,
      licenseName: license.licenceCategoryType.licencecategorytypename,
      licenseKey: license.licencekey || "N/A",
      expirationDate: new Date(license.expirationdate!).toLocaleDateString(),
      daysRemaining: daysRemaining.toString(),
    });

    const subject = renderTemplate(template.subject, {
      licenseName: license.licenceCategoryType.licencecategorytypename,
    });

    await queueEmail(
      license.user.userid,
      "license_expiry",
      license.user.email,
      subject,
      html,
    );
    notified++;
  }

  return notified;
}

/**
 * Check and notify about maintenance due
 */
export async function checkMaintenanceDue(): Promise<number> {
  const defaultDays = 7;

  const now = new Date();
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + defaultDays);

  const dueMaintenance = await prisma.maintenance_schedules.findMany({
    where: {
      isActive: true,
      nextDueDate: {
        gte: now,
        lte: maxDate,
      },
    },
    include: {
      asset: true,
      user: true,
    },
  });

  let notified = 0;

  for (const maintenance of dueMaintenance) {
    const user = maintenance.user;
    if (!user?.email) continue;

    const prefs = await getUserNotificationPrefs(user.userid);
    if (!prefs?.emailMaintenanceDue) continue;

    const template = emailTemplates.maintenanceDue;
    const html = renderTemplate(template.html, {
      userName: `${user.firstname} ${user.lastname}`,
      assetName: maintenance.asset.assetname,
      assetTag: maintenance.asset.assettag,
      maintenanceTitle: maintenance.title,
      maintenanceDescription: maintenance.description || "",
      dueDate: new Date(maintenance.nextDueDate).toLocaleDateString(),
    });

    const subject = renderTemplate(template.subject, {
      assetName: maintenance.asset.assetname,
    });

    await queueEmail(user.userid, "maintenance", user.email, subject, html);
    notified++;
  }

  return notified;
}

/**
 * Check and notify about low stock consumables
 */
export async function checkLowStock(): Promise<number> {
  // Fetch all consumables with a minimum quantity threshold set
  const allConsumables = await prisma.consumable.findMany({
    where: {
      minQuantity: { gt: 0 },
    },
    include: {
      consumableCategoryType: true,
    },
  });

  // Filter in JavaScript to find items where quantity <= minQuantity
  const lowStockItems = allConsumables.filter(
    (item) => item.quantity <= item.minQuantity,
  );

  // Get admin users for notification
  const admins = await prisma.user.findMany({
    where: { isadmin: true },
  });

  let notified = 0;

  for (const item of lowStockItems) {
    for (const admin of admins) {
      if (!admin.email) continue;

      const prefs = await getUserNotificationPrefs(admin.userid);
      if (!prefs?.emailLowStock) continue;

      const template = emailTemplates.lowStockAlert;
      const html = renderTemplate(template.html, {
        consumableName: item.consumablename,
        currentQuantity: item.quantity.toString(),
        minQuantity: item.minQuantity.toString(),
      });

      const subject = renderTemplate(template.subject, {
        consumableName: item.consumablename,
      });

      await queueEmail(admin.userid, "low_stock", admin.email, subject, html);
      notified++;
    }
  }

  return notified;
}

/**
 * Check and notify about expiring warranties
 */
export async function checkExpiringWarranties(): Promise<number> {
  const defaultDays = 30;

  const now = new Date();
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + defaultDays);

  const expiringWarranties = await prisma.asset.findMany({
    where: {
      warrantyExpires: {
        gte: now,
        lte: maxDate,
      },
    },
  });

  const admins = await prisma.user.findMany({
    where: { isadmin: true },
  });

  let notified = 0;

  for (const asset of expiringWarranties) {
    const daysRemaining = Math.ceil(
      (new Date(asset.warrantyExpires!).getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    for (const admin of admins) {
      if (!admin.email) continue;

      const template = emailTemplates.warrantyExpiring;
      const html = renderTemplate(template.html, {
        assetName: asset.assetname,
        assetTag: asset.assettag,
        serialNumber: asset.serialnumber,
        warrantyExpires: new Date(asset.warrantyExpires!).toLocaleDateString(),
        daysRemaining: daysRemaining.toString(),
      });

      const subject = renderTemplate(template.subject, {
        assetName: asset.assetname,
      });

      await queueEmail(
        admin.userid,
        "warranty_expiry",
        admin.email,
        subject,
        html,
      );
      notified++;
    }
  }

  return notified;
}

/**
 * Get user notification preferences
 */
async function getUserNotificationPrefs(userId: string) {
  return await prisma.notification_preferences.findUnique({
    where: { userId },
  });
}

/**
 * Run all notification checks (to be called by a cron job or scheduled task)
 */
export async function runNotificationChecks(): Promise<{
  licenses: number;
  maintenance: number;
  lowStock: number;
  warranties: number;
}> {
  const [licenses, maintenance, lowStock, warranties] = await Promise.all([
    checkExpiringLicenses(),
    checkMaintenanceDue(),
    checkLowStock(),
    checkExpiringWarranties(),
  ]);

  return { licenses, maintenance, lowStock, warranties };
}
