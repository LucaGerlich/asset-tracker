import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Breadcrumb from "@/components/Breadcrumb";
import ProcurementDetail from "./ui/ProcurementDetail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Asset Tracker - Purchase Request Details",
  description: "View purchase request details",
};

export default async function ProcurementDetailPage({ params }: PageProps) {
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
    { label: "Request Details", href: `/procurement/${id}` },
  ];

  return (
    <>
      <Breadcrumb options={breadcrumbOptions} />
      <ProcurementDetail />
    </>
  );
}
