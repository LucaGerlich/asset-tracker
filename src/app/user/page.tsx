import { redirect } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import { getUsers } from "@/lib/data";
import { getOrganizationContext } from "@/lib/organization-context";
import UsersTableClient from "./ui/UsersTableClient";

export const metadata = {
  title: "Asset Tracker - Users",
  description: "Asset management tool",
};

export default async function Page() {
  const ctx = await getOrganizationContext();

  if (!ctx) {
    redirect("/login");
  }

  if (!ctx.isAdmin && !ctx.permissions.has("user:view")) {
    redirect("/dashboard");
  }

  const columnName = [
    { uid: "firstName", name: "First Name", sort: true },
    { uid: "lastName", name: "Last Name" },
    { uid: "email", name: "E-Mail" },
    { uid: "userName", name: "Username" },
    { uid: "role", name: "Role" },
    { uid: "creation_date", name: "Creation Date" },
    { uid: "actions", name: "Actions" },
  ];

  const allUsers = await getUsers();

  // Scope users to the current organization
  const orgId = ctx.organization?.id;
  const databaseUsers = orgId
    ? allUsers.filter((u) => u.organizationId === orgId)
    : allUsers;

  return (
    <div>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Users", href: "/user" },
        ]}
      />
      <UsersTableClient data={databaseUsers} columns={columnName} />
    </div>
  );
}
