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
      companyName,
      companyLogo,
      timezone,
      dateFormat,
      currency,
      defaultLanguage,
      enableDemoMode,
      autoLogoutMinutes,
      requireStrongPasswords,
      allowSelfRegistration,
      maintenanceMode,
    } = body;

    // Validate input
    if (typeof enableDemoMode !== "boolean" || typeof requireStrongPasswords !== "boolean" ||
        typeof allowSelfRegistration !== "boolean" || typeof maintenanceMode !== "boolean") {
      return NextResponse.json(
        { error: "Invalid boolean values provided" },
        { status: 400 }
      );
    }

    if (typeof autoLogoutMinutes !== "number" || autoLogoutMinutes < 0) {
      return NextResponse.json(
        { error: "Invalid auto logout minutes value" },
        { status: 400 }
      );
    }

    // Upsert general settings
    const settingsToUpsert = [
      { key: "company_name", value: companyName || "", type: "string", category: "general" },
      { key: "company_logo", value: companyLogo || "", type: "string", category: "general" },
      { key: "timezone", value: timezone || "UTC", type: "string", category: "general" },
      { key: "date_format", value: dateFormat || "MM/DD/YYYY", type: "string", category: "general" },
      { key: "currency", value: currency || "USD", type: "string", category: "general" },
      { key: "default_language", value: defaultLanguage || "en", type: "string", category: "general" },
      { key: "demo_mode", value: String(enableDemoMode), type: "boolean", category: "general" },
      { key: "auto_logout_minutes", value: String(autoLogoutMinutes), type: "number", category: "general" },
      { key: "require_strong_passwords", value: String(requireStrongPasswords), type: "boolean", category: "general" },
      { key: "allow_self_registration", value: String(allowSelfRegistration), type: "boolean", category: "general" },
      { key: "maintenance_mode", value: String(maintenanceMode), type: "boolean", category: "general" },
    ];

    // Use transaction for atomicity and Promise.all for performance
    await prisma.$transaction(
      settingsToUpsert.map((setting) =>
        prisma.systemSettings.upsert({
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
          },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/admin/settings/general error:", error);
    return NextResponse.json(
      { error: "Failed to save general settings" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
