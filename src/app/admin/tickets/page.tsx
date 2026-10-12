import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Breadcrumb from "@/components/Breadcrumb";
import KanbanBoard from "./ui/KanbanBoard";
import { getOrganizationContext } from "@/lib/organization-context";
import { getAdminUsers, getTickets } from "./data";

export const metadata = {
  title: "Tickets - Asset Tracker",
  description: "Manage user tickets and requests",
};

export default async function TicketsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.isadmin) {
    redirect("/dashboard");
  }

  const ctx = await getOrganizationContext();
  const organizationId = ctx?.organization?.id ?? null;
  const [tickets, adminUsers] = await Promise.all([
    getTickets(organizationId),
    getAdminUsers(organizationId),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Admin", href: "/admin" },
          { label: "Tickets" },
        ]}
      />
      <div className="mt-6">
        <h1 className="mb-6 text-3xl font-bold">Ticket Management</h1>
        <KanbanBoard tickets={tickets} adminUsers={adminUsers} />
      </div>
    </div>
  );
}
