"use client";
import React from "react";
import { DataTable } from "@/components/ui/data-table";
import { createColumnHelper } from "@tanstack/react-table";

export default function LicencesTable({ items, catById, manuById, supplierById }) {
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
    col.accessor((r) => r.licencekey ?? "-", { id: "licencekey", header: "Key" }),
    col.accessor((r) => r.licensedtoemail ?? "-", { id: "licensedtoemail", header: "Licensed To" }),
    col.accessor((r) => catById.get(r.licencecategorytypeid) ?? "-", { id: "category", header: "Category" }),
    col.accessor((r) => manuById.get(r.manufacturerid) ?? "-", { id: "manufacturer", header: "Manufacturer" }),
    col.accessor((r) => supplierById.get(r.supplierid) ?? "-", { id: "supplier", header: "Supplier" }),
    col.accessor((r) => (r.expirationdate ? new Date(r.expirationdate).toLocaleDateString() : "-"), { id: "expires", header: "Expires" }),
  ];
  const filters = React.useMemo(() => (
    [
      {
        columnId: "category",
        title: "Category",
        options: optionsFromMap(catById),
      },
      {
        columnId: "manufacturer",
        title: "Manufacturer",
        options: optionsFromMap(manuById),
      },
      {
        columnId: "supplier",
        title: "Supplier",
        options: optionsFromMap(supplierById),
      },
    ].filter((f) => f.options.length)
  ), [optionsFromMap, catById, manuById, supplierById]);

  return <DataTable columns={columns} data={items} searchableColumn="licencekey" filters={filters} />;
}
