import React from "react";
import Breadcrumb from "@/components/Breadcrumb";
import { getUsers } from "@/lib/data";
import UsersTableClient from "./ui/UsersTableClient";

export const metadata = {
  title: "Asset Tracker - Users",
  description: "Asset management tool",
};

export default async function Page() {
  const columnName = [
    { uid: "firstName", name: "First Name", sort: true },
    { uid: "lastName", name: "Last Name" },
    { uid: "email", name: "E-Mail" },
    { uid: "userName", name: "Username" },
    { uid: "role", name: "Role" },
    { uid: "creation_date", name: "Creation Date" },
    { uid: "actions", name: "Actions" },
  ];

  const databaseUsers = await getUsers();

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
