"use client";
import React from "react";
import { DataTable } from "@/components/ui/data-table";
import { createColumnHelper } from "@tanstack/react-table";

export default function LocationsTable({ items }) {
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
    col.accessor((r) => r.locationname, { id: "locationname", header: "Name" }),
    col.accessor((r) => (r.street ? `${r.street} ${r.housenumber ?? ""}`.trim() : "-"), { id: "street", header: "Street" }),
    col.accessor((r) => r.city ?? "-", { id: "city", header: "City" }),
    col.accessor((r) => r.country ?? "-", { id: "country", header: "Country" }),
  ];
  const filters = React.useMemo(() => (
    [
      {
        columnId: "city",
        title: "City",
        options: toOptions(items.map((r) => r.city ?? "")),
      },
      {
        columnId: "country",
        title: "Country",
        options: toOptions(items.map((r) => r.country ?? "")),
      },
    ].filter((f) => f.options.length)
  ), [items, toOptions]);

  return <DataTable columns={columns} data={items} searchableColumn="locationname" filters={filters} />;
}
