import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Breadcrumb from "@/components/Breadcrumb";
import TicketsPageClient from "./ui/TicketsPageClient";

export const metadata = {
  title: "IT Tickets - Asset Tracker",
  description: "View IT support tickets from Freshdesk",
};

export default async function Page() {
  const session = await auth();

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
      <TicketsPageClient isAdmin={session.user.isAdmin || false} />
    </>
  );
}
