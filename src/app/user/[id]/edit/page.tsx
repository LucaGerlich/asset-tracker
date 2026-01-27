import React from "react";
import { getUserById } from "@/lib/data";
import UserEditForm from "./ui/UserEditForm";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getUserById(params.id);
  return <UserEditForm initial={user} />;
}
