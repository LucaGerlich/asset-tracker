import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Breadcrumb from "@/components/Breadcrumb";
import PurchaseOrderList from "./ui/PurchaseOrderList";

export const metadata = {
  title: "Asset Tracker - Purchase Orders",
  description: "Manage purchase orders",
};

export default async function PurchaseOrdersPage() {
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
    { label: "Purchase Orders", href: "/procurement/orders" },
  ];

  return (
    <>
      <Breadcrumb options={breadcrumbOptions} />
      <PurchaseOrderList />
    </>
  );
}
