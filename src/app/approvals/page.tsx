import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Breadcrumb from "@/components/Breadcrumb";
import ApprovalsPageClient from "./ui/ApprovalsPageClient";

export const metadata = {
  title: "Approval Workflows - Asset Tracker",
  description: "Manage and review approval requests",
};

export default async function Page() {
  const session = await auth();

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
      <ApprovalsPageClient isAdmin={session.user.isAdmin || false} />
    </>
  );
}
