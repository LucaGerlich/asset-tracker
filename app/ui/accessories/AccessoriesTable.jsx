"use client";
import React from "react";
import { DataTable } from "@/components/ui/data-table";
import { createColumnHelper } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AccessoriesTable({ items, manuById, modelById, statusById, categoryById, locationById, supplierById }) {
  const col = createColumnHelper();
  const optionsFromMap = React.useCallback((map) => {
    if (!map) return [];
    return Array.from(map.values()).reduce((acc, value) => {
      if (!value) return acc;
      if (acc.some((opt) => opt.value === value)) return acc;
      acc.push({ value, label: value });
      return acc;
    }, []);
  }, []);
  const columns = [
    col.accessor((r) => r.accessoriename, { id: "accessoriename", header: "Name" }),
    col.accessor((r) => r.accessorietag, { id: "tag", header: "Tag" }),
    col.accessor((r) => manuById.get(r.manufacturerid) ?? "-", { id: "manufacturer", header: "Manufacturer" }),
    col.accessor((r) => modelById.get(r.modelid) ?? "-", { id: "model", header: "Model" }),
    col.accessor((r) => statusById.get(r.statustypeid) ?? "-", { id: "status", header: "Status" }),
    col.accessor((r) => categoryById.get(r.accessoriecategorytypeid) ?? "-", { id: "category", header: "Category" }),
    col.accessor((r) => locationById.get(r.locationid) ?? "-", { id: "location", header: "Location" }),
    col.accessor((r) => supplierById.get(r.supplierid) ?? "-", { id: "supplier", header: "Supplier" }),
    col.accessor((r) => (r.requestable ? "Yes" : "No"), { id: "requestable", header: "Requestable" }),
    col.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button asChild variant="light" size="sm"><Link href="#">View</Link></Button>
          <Button asChild variant="light" size="sm"><Link href="#">Edit</Link></Button>
        </div>
      ),
    }),
  ];

  // Build simple filter options
  const filters = [
    { columnId: "status", title: "Status", options: optionsFromMap(statusById) },
    { columnId: "category", title: "Category", options: optionsFromMap(categoryById) },
    { columnId: "manufacturer", title: "Manufacturer", options: optionsFromMap(manuById) },
    { columnId: "location", title: "Location", options: optionsFromMap(locationById) },
    { columnId: "supplier", title: "Supplier", options: optionsFromMap(supplierById) },
  ];

  return <DataTable columns={columns} data={items} searchableColumn="accessoriename" filters={filters.filter((f) => f.options.length)} />;
}
