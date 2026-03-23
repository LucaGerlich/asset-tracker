import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Breadcrumb from "@/components/Breadcrumb";
import TicketsPageClient from "./ui/TicketsPageClient";

export const metadata = {
  title: "Asset Tracker - IT Tickets",
  description: "View IT support tickets from Freshdesk",
};

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });

  // Require authentication
  if (!session?.user) {
    redirect("/login");
  }

  const breadcrumbOptions = [
    { label: "Home", href: "/" },
    { label: "IT Tickets", href: "/tickets" },
  ];

  return (
    <>
      <Breadcrumb options={breadcrumbOptions} />
      <TicketsPageClient isAdmin={session.user.isadmin || false} />
    </>
  );
}
