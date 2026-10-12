import { notFound } from "next/navigation";
import { getUserById } from "@/lib/data";
import { requireAuth } from "@/lib/auth-guards";
import { getUserEditOptions } from "./data";
import UserEditForm from "./ui/UserEditForm";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Edit User",
};

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  // Fetched in its own try/catch so a scoped miss maps to notFound() without
  // risking swallowing requireAuth()'s redirect.
  let user;
  try {
    user = await getUserById(params.id);
  } catch {
    notFound();
  }
  const session = await requireAuth();
  const { allRoles, userRoles, departments } = await getUserEditOptions(
    session.user.organizationId ?? null,
    params.id,
  );
  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Users", href: "/user" },
          { label: "Edit" },
        ]}
      />
      <UserEditForm
        initial={user}
        isAdmin={!!session.user.isAdmin}
        initialRoles={allRoles}
        initialUserRoles={userRoles}
        initialDepartments={departments}
      />
    </>
  );
}
