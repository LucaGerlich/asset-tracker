"use client";
import React from "react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@nextui-org/react";

export default function SuppliersTable({ items }) {
  return (
    <Table aria-label="Suppliers table" isStriped>
      <TableHeader>
        <TableColumn>Name</TableColumn>
        <TableColumn>Contact</TableColumn>
        <TableColumn>Email</TableColumn>
        <TableColumn>Phone</TableColumn>
        <TableColumn>Created</TableColumn>
      </TableHeader>
      <TableBody emptyContent="No suppliers found" items={items}>
        {(item) => (
          <TableRow key={item.supplierid}>
            <TableCell>{item.suppliername}</TableCell>
            <TableCell>
              {item.firstname || item.lastname
                ? `${item.firstname ?? ""} ${item.lastname ?? ""}`.trim()
                : "-"}
            </TableCell>
            <TableCell>{item.email ?? "-"}</TableCell>
            <TableCell>{item.phonenumber ?? "-"}</TableCell>
            <TableCell>
              {item.creation_date ? new Date(item.creation_date).toLocaleDateString() : "-"}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

