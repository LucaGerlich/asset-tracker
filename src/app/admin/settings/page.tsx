import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AdminSettingsPage from "./ui/AdminSettingsPage";
import Breadcrumb from "@/components/Breadcrumb";
import prisma from "@/lib/prisma";

export const metadata = {
  title: "Admin Settings - Asset Tracker",
  description: "Configure system settings and preferences",
};

async function getSystemSettings() {
  const settings = await prisma.system_settings.findMany({
    orderBy: [{ category: "asc" }, { settingKey: "asc" }],
  });

  // Group settings by category
  const grouped: Record<string, Array<{
    id: string;
    key: string;
    value: string | null;
    type: string;
    description: string | null;
    isEncrypted: boolean;
  }>> = {};

  for (const setting of settings) {
    if (!grouped[setting.category]) {
      grouped[setting.category] = [];
    }
    grouped[setting.category].push({
      id: setting.id,
      key: setting.settingKey,
      value: setting.isEncrypted ? "********" : setting.settingValue,
      type: setting.settingType,
      description: setting.description,
      isEncrypted: setting.isEncrypted,
    });
  }

  return grouped;
}

async function getUsers() {
  return await prisma.user.findMany({
    select: {
      userid: true,
      username: true,
      firstname: true,
      lastname: true,
      email: true,
      isadmin: true,
      canrequest: true,
      creation_date: true,
    },
    orderBy: [{ isadmin: "desc" }, { lastname: "asc" }],
  });
}

async function getEmailTemplates() {
  return await prisma.email_templates.findMany({
    orderBy: { name: "asc" },
  });
}

async function getLabelTemplates() {
  return await prisma.label_templates.findMany({
    orderBy: { name: "asc" },
  });
}

async function getCustomFields() {
  return await prisma.custom_field_definitions.findMany({
    orderBy: [{ entityType: "asc" }, { displayOrder: "asc" }],
  });
}

async function getDepreciationSettings() {
  return await prisma.depreciation_settings.findMany({
    include: {
      assetCategoryType: true,
    },
  });
}

export default async function Page() {
  const session = await auth();

  // Require admin access
  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  const [settings, users, emailTemplates, labelTemplates, customFields, depreciationSettings] =
    await Promise.all([
      getSystemSettings(),
      getUsers(),
      getEmailTemplates(),
      getLabelTemplates(),
      getCustomFields(),
      getDepreciationSettings(),
    ]);

  const breadcrumbOptions = [
    { label: "Home", href: "/" },
    { label: "Admin Settings", href: "/admin/settings" },
  ];

  return (
    <>
      <Breadcrumb options={breadcrumbOptions} />
      <AdminSettingsPage
        settings={settings}
        users={users}
        emailTemplates={emailTemplates}
        labelTemplates={labelTemplates}
        customFields={customFields}
        depreciationSettings={depreciationSettings}
      />
    </>
  );
}
