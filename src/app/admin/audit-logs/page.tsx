import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Breadcrumb from "@/components/Breadcrumb";
import AuditLogViewer from "./ui/AuditLogViewer";

export const metadata = {
  title: "Admin - Audit Logs",
  description: "View and search system audit logs",
};

export default async function AuditLogsPage() {
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
          { label: "Audit Logs" },
        ]}
      />
      <div className="mt-6">
        <AuditLogViewer />
      </div>
    </div>
  );
}
