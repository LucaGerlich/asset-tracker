"use client";
import React from "react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@nextui-org/react";

export default function LicencesTable({ items, catById, manuById, supplierById }) {
  return (
    <Table aria-label="Licences table" isStriped>
      <TableHeader>
        <TableColumn>Key</TableColumn>
        <TableColumn>Licensed To</TableColumn>
        <TableColumn>Category</TableColumn>
        <TableColumn>Manufacturer</TableColumn>
        <TableColumn>Supplier</TableColumn>
        <TableColumn>Expires</TableColumn>
      </TableHeader>
      <TableBody emptyContent="No licences found" items={items}>
        {(item) => (
          <TableRow key={item.licenceid}>
            <TableCell>{item.licencekey ?? "-"}</TableCell>
            <TableCell>{item.licensedtoemail ?? "-"}</TableCell>
            <TableCell>{catById.get(item.licencecategorytypeid) ?? "-"}</TableCell>
            <TableCell>{manuById.get(item.manufacturerid) ?? "-"}</TableCell>
            <TableCell>{supplierById.get(item.supplierid) ?? "-"}</TableCell>
            <TableCell>
              {item.expirationdate ? new Date(item.expirationdate).toLocaleDateString() : "-"}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

