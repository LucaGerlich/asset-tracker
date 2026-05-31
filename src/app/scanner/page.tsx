import Breadcrumb from "@/components/Breadcrumb";
import ScannerPageClient from "./ui/ScannerPageClient";
import { getOrganizationContext } from "@/lib/organization-context";

export const metadata = {
  title: "Asset Tracker - QR Scanner",
  description: "Scan and generate QR codes for assets",
};

export default async function Page() {
  let ctx;
  try {
    ctx = await getOrganizationContext();
  } catch {
    /* non-admin context resolution is optional */
  }
  const isAdmin = ctx?.isAdmin ?? true;

  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "QR Scanner", href: "/scanner" },
        ]}
      />
      <ScannerPageClient isAdmin={isAdmin} />
    </>
  );
}
