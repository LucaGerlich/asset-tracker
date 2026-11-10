import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Breadcrumb from "@/components/Breadcrumb";
import WorkflowsPageClient from "./ui/WorkflowsPageClient";

export const metadata = {
  title: "Admin - Automation Rules",
  description: "Manage automation rules and workflows",
};

export default async function WorkflowsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.isadmin) {
    redirect("/dashboard");
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Admin", href: "/admin/settings" },
          { label: "Automation Rules" },
        ]}
      />
      <div className="mt-6">
        <WorkflowsPageClient />
      </div>
    </div>
  );
}
