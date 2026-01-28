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

    // Upsert general settings
    const settingsToUpsert = [
      { key: "company_name", value: companyName, type: "string", category: "general" },
      { key: "company_logo", value: companyLogo, type: "string", category: "general" },
      { key: "timezone", value: timezone, type: "string", category: "general" },
      { key: "date_format", value: dateFormat, type: "string", category: "general" },
      { key: "currency", value: currency, type: "string", category: "general" },
      { key: "default_language", value: defaultLanguage, type: "string", category: "general" },
      { key: "demo_mode", value: String(enableDemoMode), type: "boolean", category: "general" },
      { key: "auto_logout_minutes", value: String(autoLogoutMinutes), type: "number", category: "general" },
      { key: "require_strong_passwords", value: String(requireStrongPasswords), type: "boolean", category: "general" },
      { key: "allow_self_registration", value: String(allowSelfRegistration), type: "boolean", category: "general" },
      { key: "maintenance_mode", value: String(maintenanceMode), type: "boolean", category: "general" },
    ];

    for (const setting of settingsToUpsert) {
      await prisma.systemSettings.upsert({
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
      });
    }

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
