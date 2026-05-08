import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Breadcrumb from "@/components/Breadcrumb";
import ProcurementList from "./ui/ProcurementList";

export const metadata = {
  title: "Asset Tracker - Procurement",
  description: "Manage purchase requests and orders",
};

export default async function ProcurementPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.isadmin) {
    redirect("/dashboard");
  }

  const breadcrumbOptions = [
    { label: "Home", href: "/" },
    { label: "Procurement", href: "/procurement" },
  ];

  return (
    <>
      <Breadcrumb options={breadcrumbOptions} />
      <ProcurementList />
    </>
  );
}
