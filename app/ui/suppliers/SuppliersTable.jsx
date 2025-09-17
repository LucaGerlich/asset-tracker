"use client";
import React from "react";
import { DataTable } from "@/components/ui/data-table";
import { createColumnHelper } from "@tanstack/react-table";

export default function SuppliersTable({ items }) {
  const col = createColumnHelper();
  const columns = [
    col.accessor((r) => r.suppliername, { id: "suppliername", header: "Name" }),
    col.accessor((r) => {
      const contact = `${r.firstname ?? ""} ${r.lastname ?? ""}`.trim();
      return contact || "No Contact";
    }, {
      id: "contact",
      header: "Contact",
      cell: (info) => (info.getValue() === "No Contact" ? "-" : info.getValue()),
    }),
    col.accessor((r) => r.email ?? "No Email", {
      id: "email",
      header: "Email",
      cell: (info) => (info.getValue() === "No Email" ? "-" : info.getValue()),
    }),
    col.accessor((r) => r.phonenumber ?? "No Phone", {
      id: "phone",
      header: "Phone",
      cell: (info) => (info.getValue() === "No Phone" ? "-" : info.getValue()),
    }),
    col.accessor((r) => (r.creation_date ? new Date(r.creation_date).toLocaleDateString() : "-"), { id: "created", header: "Created" }),
  ];

  const filters = React.useMemo(() => {
    const optionFrom = (values) => {
      const seen = new Set();
      const opts = [];
      values.forEach((value) => {
        if (!value) return;
        if (seen.has(value)) return;
        seen.add(value);
        opts.push({ value, label: value });
      });
      return opts;
    };

    const contactOptions = optionFrom(items.map((item) => {
      const contact = `${item.firstname ?? ""} ${item.lastname ?? ""}`.trim();
      return contact || "No Contact";
    }));

    const emailOptions = optionFrom(items.map((item) => item.email ?? "No Email"));

    const phoneOptions = optionFrom(items.map((item) => item.phonenumber ?? "No Phone"));

    return [
      { columnId: "contact", title: "Contact", options: contactOptions },
      { columnId: "email", title: "Email", options: emailOptions },
      { columnId: "phone", title: "Phone", options: phoneOptions },
    ].filter((f) => f.options.length);
  }, [items]);

  return <DataTable columns={columns} data={items} searchableColumn="suppliername" filters={filters} />;
}
