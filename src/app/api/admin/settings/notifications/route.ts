import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      enableAssignmentEmails,
      enableUnassignmentEmails,
      enableLicenseExpiryEmails,
      enableMaintenanceEmails,
      enableLowStockEmails,
      enableWarrantyEmails,
      licenseExpiryDays,
      maintenanceReminderDays,
      lowStockThreshold,
      warrantyExpiryDays,
    } = body;

    // Validate input
    if (typeof enableAssignmentEmails !== "boolean" || typeof enableUnassignmentEmails !== "boolean" ||
        typeof enableLicenseExpiryEmails !== "boolean" || typeof enableMaintenanceEmails !== "boolean" ||
        typeof enableLowStockEmails !== "boolean" || typeof enableWarrantyEmails !== "boolean") {
      return NextResponse.json(
        { error: "Invalid boolean values provided" },
        { status: 400 }
      );
    }

    if (typeof licenseExpiryDays !== "number" || licenseExpiryDays < 1 ||
        typeof maintenanceReminderDays !== "number" || maintenanceReminderDays < 1 ||
        typeof lowStockThreshold !== "number" || lowStockThreshold < 1 ||
        typeof warrantyExpiryDays !== "number" || warrantyExpiryDays < 1) {
      return NextResponse.json(
        { error: "Invalid number values provided" },
        { status: 400 }
      );
    }

    // Upsert notification settings
    const settingsToUpsert = [
      { key: "notify_assignments", value: String(enableAssignmentEmails), type: "boolean", category: "notifications" },
      { key: "notify_unassignments", value: String(enableUnassignmentEmails), type: "boolean", category: "notifications" },
      { key: "notify_license_expiry", value: String(enableLicenseExpiryEmails), type: "boolean", category: "notifications" },
      { key: "notify_maintenance", value: String(enableMaintenanceEmails), type: "boolean", category: "notifications" },
      { key: "notify_low_stock", value: String(enableLowStockEmails), type: "boolean", category: "notifications" },
      { key: "notify_warranty_expiry", value: String(enableWarrantyEmails), type: "boolean", category: "notifications" },
      { key: "license_expiry_days", value: String(licenseExpiryDays), type: "number", category: "notifications" },
      { key: "maintenance_reminder_days", value: String(maintenanceReminderDays), type: "number", category: "notifications" },
      { key: "low_stock_threshold", value: String(lowStockThreshold), type: "number", category: "notifications" },
      { key: "warranty_expiry_days", value: String(warrantyExpiryDays), type: "number", category: "notifications" },
    ];

    // Use transaction for atomicity and Promise.all for performance
    await prisma.$transaction(
      settingsToUpsert.map((setting) =>
        prisma.system_settings.upsert({
          where: { settingKey: setting.key },
          update: {
            settingValue: setting.value,
            updatedAt: new Date(),
          },
          create: {
            settingKey: setting.key,
            settingValue: setting.value,
            settingType: setting.type,
            category: setting.category,
            isEncrypted: false,
            updatedAt: new Date(),
          },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/admin/settings/notifications error:", error);
    return NextResponse.json(
      { error: "Failed to save notification settings" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
