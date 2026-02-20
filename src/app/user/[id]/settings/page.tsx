import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Breadcrumb from "@/components/Breadcrumb";
import prisma from "@/lib/prisma";
import UserSettingsClient from "./ui/UserSettingsClient";
import MfaSettings from "./ui/MfaSettings";
import SessionManagement from "./SessionManagement";

export const metadata = {
  title: "Asset Tracker - User Settings",
};

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth();

  // Only allow the user themselves or an admin to view settings
  if (!session?.user) redirect("/login");
  if (session.user.id !== params.id && !session.user.isAdmin) {
    redirect("/dashboard");
  }

  const user = await prisma.user.findUnique({
    where: { userid: params.id },
    select: {
      userid: true,
      firstname: true,
      lastname: true,
      email: true,
      mfaEnabled: true,
    },
  });

  if (!user) redirect("/user");

  const prefs = await prisma.user_preferences.findUnique({
    where: { userId: params.id },
  });

  const preferences = prefs
    ? {
        theme: prefs.theme,
        locale: prefs.locale,
        timezone: prefs.timezone,
        currency: prefs.currency,
        dateFormat: prefs.dateFormat,
        numberFormat: prefs.numberFormat,
        pageSize: prefs.pageSize,
      }
    : {
        theme: "system",
        locale: "en",
        timezone: "UTC",
        currency: "USD",
        dateFormat: "MM/DD/YYYY",
        numberFormat: "1,234.56",
        pageSize: 20,
      };

  const breadcrumbOptions = [
    { label: "Home", href: "/" },
    { label: "Users", href: "/user" },
    {
      label: `${user.firstname} ${user.lastname}`,
      href: `/user/${user.userid}`,
    },
    { label: "Settings", href: `/user/${user.userid}/settings` },
  ];

  return (
    <>
      <Breadcrumb options={breadcrumbOptions} />
      <UserSettingsClient user={user} preferences={preferences} />
      <div className="mt-6 max-w-2xl">
        <MfaSettings userId={user.userid} mfaEnabled={user.mfaEnabled} />
      </div>
      <div className="mt-6 max-w-2xl">
        <SessionManagement />
      </div>
    </>
  );
}
