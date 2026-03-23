import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Breadcrumb from "@/components/Breadcrumb";
import ApprovalsPageClient from "./ui/ApprovalsPageClient";

export const metadata = {
  title: "Asset Tracker - Approvals",
  description: "Manage and review approval requests",
};

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  const breadcrumbOptions = [
    { label: "Home", href: "/" },
    { label: "Approvals", href: "/approvals" },
  ];

  return (
    <>
      <Breadcrumb options={breadcrumbOptions} />
      <ApprovalsPageClient isAdmin={session.user.isadmin || false} />
    </>
  );
}
