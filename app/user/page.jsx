import React from "react";
import DashboardTable from "../ui/user/DashboardTable";
import { getUsers } from "@/app/lib/data";
import { Button } from "../lib/nextui";
import { PlusIcon } from "../ui/Icons";
import Link from "next/link";

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
      <DashboardTable
        data={databaseUsers}
        columns={columnName}
      ></DashboardTable>
      <div className="flex flex-row justify-end mt-4">
        <Link href="/user/create/">
          <Button color="primary" startContent={icons.plus}>
            Add User
          </Button>
        </Link>
      </div>
    </div>
  );
}
