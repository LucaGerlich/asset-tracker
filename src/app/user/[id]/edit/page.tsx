import React from "react";
import { getUserById } from "@/lib/data";
import { requireAuth } from "@/lib/auth-guards";
import UserEditForm from "./ui/UserEditForm";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Edit User",
};

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [user, session] = await Promise.all([
    getUserById(params.id),
    requireAuth(),
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
      <UserEditForm initial={user} isAdmin={!!session.user.isAdmin} />
    </>
  );
}
