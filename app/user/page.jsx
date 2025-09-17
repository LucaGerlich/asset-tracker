import React from "react";
import { getUsers } from "@/app/lib/data";
import { PlusIcon } from "../ui/Icons";
import Link from "next/link";
import UsersTableClient from "./ui/UsersTableClient";
import { Button } from "@/components/ui/button";

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

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Button asChild>
          <Link href="/user/create" className="inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            Create User
          </Link>
        </Button>
      </div>
      <UsersTableClient data={databaseUsers} columns={columnName} />
    </div>
  );
}
