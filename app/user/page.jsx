import React from "react";
import { getUsers } from "@/app/lib/data";
import { PlusIcon } from "../ui/Icons";
import Link from "next/link";
import UsersTableClient from "./ui/UsersTableClient";

// export const metadata = {
//   title: "Asset Tracker - User",
//   description: "Asset management tool",
// };

export default async function Page() {
  const columnName = [
    { uid: "firstName", name: "First Name", sort: true },
    { uid: "lastName", name: "Last Name" },
    { uid: "email", name: "E-Mail" },
    { uid: "userName", name: "Username" },
    { uid: "creation_date", name: "Creation Date" },
    { uid: "actions", name: "Actions" },
  ];

  const databaseUsers = await getUsers();

  const icons = {
    plus: <PlusIcon />,
  };

  return (
    <div>
      <UsersTableClient data={databaseUsers} columns={columnName} />
      <div className="flex flex-row justify-end mt-4">
        <Link
          href="/user/create/"
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium shadow hover:opacity-90"
        >
          {icons.plus}
          Add User
        </Link>
      </div>
    </div>
  );
}
