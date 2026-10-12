import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Breadcrumb from "@/components/Breadcrumb";
import prisma from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/super-admin";
import GDPRDashboard from "./ui/GDPRDashboard";

export const metadata = {
  title: "GDPR Management - Asset Tracker",
  description:
    "Manage GDPR data exports, anonymization, and retention policies",
};

export default async function GDPRPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.isadmin) {
    redirect("/dashboard");
  }

  // Retention is one deployment-wide setting: only a platform super-admin may
  // change it. The email comes from the database row, never from the session.
  const adminUser = await prisma.user.findUnique({
    where: { userid: session.user.id },
    select: { email: true },
  });
  const canEditRetention = await isSuperAdmin({
    id: session.user.id,
    email: adminUser?.email,
  });

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
        <GDPRDashboard canEditRetention={canEditRetention} />
      </div>
    </div>
  );
}
