import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Breadcrumb from "@/components/Breadcrumb";
import PurchaseOrderDetail from "./ui/PurchaseOrderDetail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Asset Tracker - Purchase Order Details",
  description: "View purchase order details",
};

export default async function PurchaseOrderDetailPage({ params }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.isadmin) {
    redirect("/dashboard");
  }

  const { id } = await params;

  const breadcrumbOptions = [
    { label: "Home", href: "/" },
    { label: "Procurement", href: "/procurement" },
    { label: "Purchase Orders", href: "/procurement/orders" },
    { label: "Order Details", href: `/procurement/orders/${id}` },
  ];

  return (
    <>
      <Breadcrumb options={breadcrumbOptions} />
      <PurchaseOrderDetail />
    </>
  );
}
