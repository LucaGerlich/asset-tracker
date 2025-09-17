"use client";
import React from "react";
import { DataTable } from "@/components/ui/data-table";
import { createColumnHelper } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function UsersDataTable({ data }) {
  const col = createColumnHelper();
  const toOptions = React.useCallback((values) => {
    const unique = [];
    const seen = new Set();
    values.forEach((value) => {
      if (!value) return;
      if (seen.has(value)) return;
      seen.add(value);
      unique.push({ value, label: value });
    });
    return unique;
  }, []);
  const columns = [
    col.accessor((r) => r.firstname, { id: "firstname", header: "First Name" }),
    col.accessor((r) => r.lastname, { id: "lastname", header: "Last Name" }),
    col.accessor((r) => r.email ?? "-", { id: "email", header: "E-Mail" }),
    col.accessor((r) => r.username ?? "-", { id: "username", header: "Username" }),
    col.accessor((r) => (r.isadmin ? "Admin" : "User"), { id: "role", header: "Role" }),
    col.accessor((r) => (r.canrequest ? "Yes" : "No"), { id: "requester", header: "Requester" }),
    col.accessor((r) => (r.creation_date ? new Date(r.creation_date).toISOString().slice(0, 19).replace('T', ' ') : "-"), { id: "creation_date", header: "Created" }),
    col.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button asChild variant="light" size="sm"><Link href={`user/${row.original.userid}`}>View</Link></Button>
          <Button asChild variant="light" size="sm"><Link href={`user/${row.original.userid}/edit`}>Edit</Link></Button>
        </div>
      ),
    }),
  ];
  const filters = React.useMemo(() => (
    [
      {
        columnId: "role",
        title: "Role",
        options: toOptions(["Admin", "User"]),
      },
      {
        columnId: "requester",
        title: "Requester",
        options: toOptions(["Yes", "No"]),
      },
    ]
  ), [toOptions]);

  return <DataTable columns={columns} data={data} searchableColumn="firstname" filters={filters} />;
}
