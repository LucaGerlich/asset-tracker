"use client";
import React from "react";
import { DataTable } from "@/components/ui/data-table";
import { createColumnHelper } from "@tanstack/react-table";

export default function ManufacturersTable({ items }) {
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
    col.accessor((r) => r.manufacturername, { id: "manufacturername", header: "Name", cell: (info) => info.getValue() }),
    col.accessor((r) => (r.creation_date ? new Date(r.creation_date).toLocaleDateString() : "-"), { id: "created", header: "Created" }),
  ];
  const filters = React.useMemo(() => (
    [
      {
        columnId: "manufacturername",
        title: "Name",
        options: toOptions(items.map((r) => r.manufacturername ?? "")),
      },
      {
        columnId: "created",
        title: "Created Year",
        options: toOptions(items.map((r) => (r.creation_date ? String(new Date(r.creation_date).getFullYear()) : ""))),
      },
    ].filter((f) => f.options.length)
  ), [items, toOptions]);

  return <DataTable columns={columns} data={items} searchableColumn="manufacturername" filters={filters} />;
}
