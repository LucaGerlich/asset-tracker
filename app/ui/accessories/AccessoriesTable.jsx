"use client";
import React from "react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip } from "@nextui-org/react";

export default function AccessoriesTable({ items, manuById, modelById, statusById, categoryById, locationById, supplierById }) {
  return (
    <Table aria-label="Accessories table" isStriped>
      <TableHeader>
        <TableColumn>Name</TableColumn>
        <TableColumn>Tag</TableColumn>
        <TableColumn>Manufacturer</TableColumn>
        <TableColumn>Model</TableColumn>
        <TableColumn>Status</TableColumn>
        <TableColumn>Category</TableColumn>
        <TableColumn>Location</TableColumn>
        <TableColumn>Supplier</TableColumn>
        <TableColumn>Requestable</TableColumn>
      </TableHeader>
      <TableBody emptyContent="No accessories found" items={items}>
        {(item) => (
          <TableRow key={item.accessorieid}>
            <TableCell>{item.accessoriename}</TableCell>
            <TableCell>{item.accessorietag}</TableCell>
            <TableCell>{manuById.get(item.manufacturerid) ?? "-"}</TableCell>
            <TableCell>{modelById.get(item.modelid) ?? "-"}</TableCell>
            <TableCell>
              {statusById.get(item.statustypeid) ? (
                <Chip size="sm" color="primary" variant="flat">
                  {statusById.get(item.statustypeid)}
                </Chip>
              ) : (
                "-"
              )}
            </TableCell>
            <TableCell>{categoryById.get(item.accessoriecategorytypeid) ?? "-"}</TableCell>
            <TableCell>{locationById.get(item.locationid) ?? "-"}</TableCell>
            <TableCell>{supplierById.get(item.supplierid) ?? "-"}</TableCell>
            <TableCell>{item.requestable ? "Yes" : "No"}</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

