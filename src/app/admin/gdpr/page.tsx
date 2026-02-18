import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Breadcrumb from "@/components/Breadcrumb";
import GDPRDashboard from "./ui/GDPRDashboard";

export const metadata = {
  title: "GDPR Management - Asset Tracker",
  description: "Manage GDPR data exports, anonymization, and retention policies",
};

export default async function GDPRPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.isAdmin) {
    redirect("/");
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Admin", href: "/admin/settings" },
          { label: "GDPR Management" },
        ]}
      />
      <div className="mt-6">
        <GDPRDashboard />
      </div>
    </div>
  );
}
