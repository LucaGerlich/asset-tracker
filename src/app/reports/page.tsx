import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import ReportsPage from "./ui/ReportsPage";
import Breadcrumb from "@/components/Breadcrumb";
import { getOrganizationContext } from "@/lib/organization-context";
import { getReportData } from "./data";

export const metadata = {
  title: "Asset Tracker - Reports",
  description: "View analytics and generate reports",
};

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  const ctx = await getOrganizationContext();
  const reportData = await getReportData(ctx?.organization?.id ?? null);

  const breadcrumbOptions = [
    { label: "Home", href: "/" },
    { label: "Reports", href: "/reports" },
  ];

  return (
    <>
      <Breadcrumb options={breadcrumbOptions} />
      <ReportsPage
        data={reportData}
        warrantyAssets={reportData.warrantyAssets}
        depreciationAssets={reportData.depreciationAssets}
      />
    </>
  );
}
