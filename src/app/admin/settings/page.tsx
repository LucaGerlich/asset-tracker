import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import AdminSettingsPage from "./ui/AdminSettingsPage";
import Breadcrumb from "@/components/Breadcrumb";
import prisma from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/super-admin";
import { MASKED_VALUE } from "@/lib/settings-keys";

export const metadata = {
  title: "Admin Settings - Asset Tracker",
  description: "Configure system settings and preferences",
};

type GroupedSettings = Record<
  string,
  Array<{
    id: string;
    key: string;
    value: string | null;
    type: string;
    description: string | null;
    isEncrypted: boolean;
  }>
>;

/**
 * Platform-wide system settings, grouped by category. The table is shared by
 * every tenant: call this only for a super-admin. Short-lived sso.token.*
 * login rows are never part of the configuration and never leave the server.
 */
async function getSystemSettings(): Promise<GroupedSettings> {
  const settings = await prisma.system_settings.findMany({
    where: { NOT: { settingKey: { startsWith: "sso.token." } } },
    orderBy: [{ category: "asc" }, { settingKey: "asc" }],
  });

  // Group settings by category
  const grouped: GroupedSettings = {};

  for (const setting of settings) {
    if (!grouped[setting.category]) {
      grouped[setting.category] = [];
    }
    grouped[setting.category].push({
      id: setting.id,
      key: setting.settingKey,
      value: setting.isEncrypted ? MASKED_VALUE : setting.settingValue,
      type: setting.settingType,
      description: setting.description,
      isEncrypted: setting.isEncrypted,
    });
  }

  return grouped;
}

async function getUsers(organizationId: string | null) {
  return await prisma.user.findMany({
    where: { organizationId },
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

async function getStatusTypes(organizationId: string | null) {
  return await prisma.statusType.findMany({
    where: { organizationId },
    orderBy: { statustypename: "asc" },
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
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.isadmin) {
    redirect("/dashboard");
  }

  const adminUser = await prisma.user.findUnique({
    where: { userid: session.user.id },
    select: { organizationId: true, email: true },
  });

  // Determine if current admin is a platform super-admin. The email comes from
  // the database row, never from the session.
  const isSuperAdminUser = await isSuperAdmin({
    id: session.user.id,
    email: adminUser?.email,
  });

  const orgPlan = adminUser?.organizationId
    ? ((
        await prisma.organization.findUnique({
          where: { id: adminUser.organizationId },
          select: { plan: true },
        })
      )?.plan ?? "starter")
    : "starter";

  const [
    settings,
    users,
    emailTemplates,
    labelTemplates,
    customFields,
    depreciationSettings,
    statuses,
  ] = await Promise.all([
    // Only super-admins see platform settings; everyone else gets none.
    isSuperAdminUser
      ? getSystemSettings()
      : Promise.resolve<GroupedSettings>({}),
    getUsers(adminUser?.organizationId ?? null),
    getEmailTemplates(),
    getLabelTemplates(),
    getCustomFields(),
    getDepreciationSettings(),
    getStatusTypes(adminUser?.organizationId ?? null),
  ]);

  // Detect if email is configured via environment variables
  const envEmailConfig = process.env.EMAIL_PROVIDER
    ? {
        provider: process.env.EMAIL_PROVIDER,
        fromEmail: process.env.EMAIL_FROM || "",
        fromName: process.env.EMAIL_FROM_NAME || "Asset Tracker",
        hasApiKey: !!(
          process.env.BREVO_API_KEY ||
          process.env.SENDGRID_API_KEY ||
          process.env.MAILGUN_API_KEY ||
          process.env.POSTMARK_API_KEY
        ),
      }
    : null;

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
        envEmailConfig={envEmailConfig}
        statuses={statuses}
        isSuperAdmin={isSuperAdminUser}
        orgPlan={orgPlan as "starter" | "professional" | "enterprise"}
        isSelfHostedMode={process.env.SELF_HOSTED === "true"}
      />
    </>
  );
}
