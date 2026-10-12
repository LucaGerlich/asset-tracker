import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import AdminSettingsPage from "./ui/AdminSettingsPage";
import Breadcrumb from "@/components/Breadcrumb";
import prisma from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/super-admin";
import { MASKED_VALUE } from "@/lib/settings-keys";
import { getEnvEmailConfig } from "@/lib/env-email-config";
import {
  getCustomFields,
  getDepreciationSettings,
  getStatusTypes,
  getUsers,
} from "./data";

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

type EmailTemplates = Awaited<ReturnType<typeof getEmailTemplates>>;

// Email templates have no organization: they are platform-wide.
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
    isSuperAdminUser
      ? getEmailTemplates()
      : Promise.resolve<EmailTemplates>([]),
    getLabelTemplates(),
    getCustomFields(adminUser?.organizationId ?? null),
    getDepreciationSettings(adminUser?.organizationId ?? null),
    getStatusTypes(adminUser?.organizationId ?? null),
  ]);

  // Platform mailer configured via environment variables (super-admins only)
  const envEmailConfig = getEnvEmailConfig(isSuperAdminUser);

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
