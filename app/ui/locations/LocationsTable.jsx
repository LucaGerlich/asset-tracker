"use client";
import React from "react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@nextui-org/react";

export default function LocationsTable({ items }) {
  return (
    <Table aria-label="Locations table" isStriped>
      <TableHeader>
        <TableColumn>Name</TableColumn>
        <TableColumn>Street</TableColumn>
        <TableColumn>City</TableColumn>
        <TableColumn>Country</TableColumn>
      </TableHeader>
      <TableBody emptyContent="No locations found" items={items}>
        {(item) => (
          <TableRow key={item.locationid}>
            <TableCell>{item.locationname}</TableCell>
            <TableCell>
              {item.street ? `${item.street} ${item.housenumber ?? ""}`.trim() : "-"}
            </TableCell>
            <TableCell>{item.city ?? "-"}</TableCell>
            <TableCell>{item.country ?? "-"}</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

