import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

const DEFAULTS = {
  emailAssignments: true,
  emailUnassignments: true,
  emailLicenseExpiry: true,
  emailMaintenanceDue: true,
  emailLowStock: false,
  licenseExpiryDays: 30,
  maintenanceReminderDays: 7,
  lowStockThreshold: 10,
};

export async function GET() {
  try {
    const user = await requireApiAuth();

    const prefs = await prisma.notification_preferences.findUnique({
      where: { userId: user.id },
    });

    if (!prefs) {
      return NextResponse.json(DEFAULTS);
    }

    return NextResponse.json(prefs);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("GET /api/user/notification-preferences error", { error });
    return NextResponse.json(
      { error: "Failed to fetch notification preferences" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireApiAuth();

    const body = await request.json();
    const {
      emailAssignments,
      emailUnassignments,
      emailLicenseExpiry,
      emailMaintenanceDue,
      emailLowStock,
      licenseExpiryDays,
      maintenanceReminderDays,
      lowStockThreshold,
    } = body;

    const values: Record<string, unknown> = {};
    if (emailAssignments !== undefined)
      values.emailAssignments = Boolean(emailAssignments);
    if (emailUnassignments !== undefined)
      values.emailUnassignments = Boolean(emailUnassignments);
    if (emailLicenseExpiry !== undefined)
      values.emailLicenseExpiry = Boolean(emailLicenseExpiry);
    if (emailMaintenanceDue !== undefined)
      values.emailMaintenanceDue = Boolean(emailMaintenanceDue);
    if (emailLowStock !== undefined)
      values.emailLowStock = Boolean(emailLowStock);
    if (licenseExpiryDays !== undefined)
      values.licenseExpiryDays = Number(licenseExpiryDays);
    if (maintenanceReminderDays !== undefined)
      values.maintenanceReminderDays = Number(maintenanceReminderDays);
    if (lowStockThreshold !== undefined)
      values.lowStockThreshold = Number(lowStockThreshold);

    const prefs = await prisma.notification_preferences.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ...values,
        updatedAt: new Date(),
      },
      update: {
        ...values,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(prefs);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("PUT /api/user/notification-preferences error", { error });
    return NextResponse.json(
      { error: "Failed to update notification preferences" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
