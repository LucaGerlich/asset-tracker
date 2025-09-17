import React from "react";
import { getUserById } from "@/app/lib/data";
import UserEditForm from "./ui/UserEditForm";

export default async function Page({ params }) {
  const user = await getUserById(params.id);
  return <UserEditForm initial={user} />;
}
