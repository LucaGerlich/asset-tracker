"use client";
import React, { useCallback } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  User,
  Chip,
  Tooltip,
  getKeyValue,
} from "@nextui-org/react";
import { EditIcon, DeleteIcon, EyeIcon } from "../Icons.jsx";
import Link from "next/link";

const statusColorMap = {
  active: "success",
  paused: "danger",
  vacation: "warning",
};

function DashboardTable({ data, columns }) {
  const renderCell = useCallback((user, columnKey) => {
    const cellValue = user[columnKey];

    if (columnKey === "creation_date" || columnKey === "change_date") {
      return cellValue ? cellValue.toLocaleString() : "N/A";
    }

    switch (columnKey) {
      case "firstName":
        return <span>{user.firstname}</span>;
      case "lastName":
        return <span>{user.lastname}</span>;
      case "email":
        return (
          <div className="flex flex-col">
            <span className="text-bold text-sm ">{user.email}</span>
          </div>
        );
      case "userName":
        return <span>{user.username}</span>;
      case "actions":
        return (
          <div className="relative flex items-center gap-2">
            <Link href={`user/${user.userid}/`}>
              <span className="text-lg text-default-400 cursor-pointer active:opacity-50">
                <EyeIcon />
              </span>
            </Link>
            <Link href={`user/${user.userid}/edit/`}>
              <span className="text-lg text-default-400 cursor-pointer active:opacity-50">
                <EditIcon />
              </span>
            </Link>
            <span className="text-lg text-danger cursor-pointer active:opacity-50">
              <DeleteIcon />
            </span>
          </div>
        );
      default:
        return cellValue;
    }
  }, []);

  return (
    <Table
      isStriped
      aria-label="Example table with custom cells"
      selectionMode="multiple"
    >
      <TableHeader columns={columns}>
        {(column) => (
          <TableColumn
            key={column.uid}
            align={column.uid === "actions" ? "center" : "start"}
            // allowsSorting={column.sort === true}
          >
            {column.name}
          </TableColumn>
        )}
      </TableHeader>
      <TableBody items={data}>
        {(item) => (
          <TableRow key={item.userid}>
            {(columnKey) => (
              <TableCell>{renderCell(item, columnKey)}</TableCell>
            )}
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export default DashboardTable;
