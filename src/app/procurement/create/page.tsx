import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Breadcrumb from "@/components/Breadcrumb";
import CreatePurchaseRequest from "./ui/CreatePurchaseRequest";

export const metadata = {
  title: "Asset Tracker - New Purchase Request",
  description: "Create a new purchase request",
};

export default async function CreatePurchaseRequestPage() {
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
    { label: "New Request", href: "/procurement/create" },
  ];

  return (
    <>
      <Breadcrumb options={breadcrumbOptions} />
      <CreatePurchaseRequest />
    </>
  );
}
