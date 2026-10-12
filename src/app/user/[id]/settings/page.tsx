import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Breadcrumb from "@/components/Breadcrumb";
import { getOrganizationContext } from "@/lib/organization-context";
import { loadUserSettings } from "./data";
import UserSettingsClient from "./ui/UserSettingsClient";
import MfaSettings from "./ui/MfaSettings";
import NotificationPreferences from "./ui/NotificationPreferences";
import ChangePasswordSection from "./ui/ChangePasswordSection";
import ReportSubscriptions from "./ui/ReportSubscriptions";
import SessionManagement from "./SessionManagement";

export const metadata = {
  title: "Asset Tracker - User Settings",
};

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth.api.getSession({ headers: await headers() });

  // Only allow the user themselves or an admin to view settings
  if (!session?.user) redirect("/login");
  if (session.user.id !== params.id && !session.user.isadmin) {
    redirect("/dashboard");
  }

  const ctx = await getOrganizationContext();
  const { user, preferences } = await loadUserSettings(
    { id: session.user.id, organizationId: ctx?.organization?.id ?? null },
    params.id,
  );

  const breadcrumbOptions = [
    { label: "Home", href: "/" },
    { label: "Users", href: "/user" },
    {
      label: `${user.firstname} ${user.lastname}`,
      href: `/user/${user.userid}`,
    },
    { label: "Settings", href: `/user/${user.userid}/settings` },
  ];

  // Change-password is self-service only — an admin viewing another user's settings
  // can't legitimately know that user's current password and should use the user
  // edit form for admin-resets.
  const isViewingSelf = session.user.id === params.id;

  return (
    <>
      <Breadcrumb options={breadcrumbOptions} />
      <UserSettingsClient user={user} preferences={preferences} />
      <div className="mt-6 max-w-2xl">
        <NotificationPreferences />
      </div>
      <div className="mt-6 max-w-2xl">
        <ReportSubscriptions />
      </div>
      {isViewingSelf && (
        <div className="mt-6 max-w-2xl">
          <ChangePasswordSection />
        </div>
      )}
      <div className="mt-6 max-w-2xl">
        <MfaSettings
          enabled={user.twoFactorEnabled ?? false}
          requiresPassword={user.authProvider === "local"}
        />
      </div>
      <div className="mt-6 max-w-2xl">
        <SessionManagement />
      </div>
    </>
  );
}
