"use client";
import React from "react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@nextui-org/react";

export default function ManufacturersTable({ items }) {
  return (
    <Table aria-label="Manufacturers table" isStriped>
      <TableHeader>
        <TableColumn>Name</TableColumn>
        <TableColumn>Created</TableColumn>
      </TableHeader>
      <TableBody emptyContent="No manufacturers found" items={items}>
        {(item) => (
          <TableRow key={item.manufacturerid}>
            <TableCell>{item.manufacturername}</TableCell>
            <TableCell>{item.creation_date ? new Date(item.creation_date).toLocaleDateString() : "-"}</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

