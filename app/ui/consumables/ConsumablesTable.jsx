"use client";
import React from "react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@nextui-org/react";

export default function ConsumablesTable({ items, catById, manuById, supplierById }) {
  return (
    <Table aria-label="Consumables table" isStriped>
      <TableHeader>
        <TableColumn>Name</TableColumn>
        <TableColumn>Category</TableColumn>
        <TableColumn>Manufacturer</TableColumn>
        <TableColumn>Supplier</TableColumn>
        <TableColumn>Price</TableColumn>
        <TableColumn>Purchased</TableColumn>
      </TableHeader>
      <TableBody emptyContent="No consumables found" items={items}>
        {(item) => (
          <TableRow key={item.consumableid}>
            <TableCell>{item.consumablename}</TableCell>
            <TableCell>{catById.get(item.consumablecategorytypeid) ?? "-"}</TableCell>
            <TableCell>{manuById.get(item.manufacturerid) ?? "-"}</TableCell>
            <TableCell>{supplierById.get(item.supplierid) ?? "-"}</TableCell>
            <TableCell>{item.purchaseprice ?? "-"}</TableCell>
            <TableCell>
              {item.purchasedate ? new Date(item.purchasedate).toLocaleDateString() : "-"}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

