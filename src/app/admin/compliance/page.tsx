import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Breadcrumb from "@/components/Breadcrumb";
import ComplianceDashboard from "./ui/ComplianceDashboard";

export const metadata = {
  title: "Compliance Reporting - Asset Tracker",
  description: "SOX/HIPAA compliance reporting and audit dashboard",
};

export default async function CompliancePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.isAdmin) {
    redirect("/dashboard");
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Admin", href: "/admin/settings" },
          { label: "Compliance Reporting" },
        ]}
      />
      <div className="mt-6">
        <ComplianceDashboard />
      </div>
    </div>
  );
}
