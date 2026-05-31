import { getUserById } from "@/lib/data";
import { requireAuth } from "@/lib/auth-guards";
import prisma from "@/lib/prisma";
import UserEditForm from "./ui/UserEditForm";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Edit User",
};

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [user, session, allRoles, userRoles, departments] = await Promise.all([
    getUserById(params.id),
    requireAuth(),
    prisma.role.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.userRole.findMany({
      where: { userId: params.id },
      include: { role: { select: { id: true, name: true } } },
    }),
    prisma.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
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
        initialUserRoles={userRoles.map((ur) => ur.role)}
        initialDepartments={departments}
      />
    </>
  );
}
