import MaintenancePageClient from "./ui/MaintenancePageClient";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Maintenance Schedules - Asset Tracker",
  description: "Manage maintenance schedules",
};

export default function MaintenancePage() {
  return (
    <>
      <Breadcrumb options={[{ label: "Dashboard", href: "/" }, { label: "Maintenance" }]} />
      <MaintenancePageClient />
    </>
  );
}
