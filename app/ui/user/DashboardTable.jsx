"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Button,
  Input,
  Pagination,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { EditIcon, DeleteIcon, EyeIcon, PlusIcon, SearchIcon } from "../Icons.jsx";

const ROWS_PER_PAGE_OPTIONS = ["10", "20", "50", "100"];
const roleOptions = [
  { key: "all", label: "All roles" },
  { key: "admin", label: "Admins" },
  { key: "requester", label: "Requesters" },
  { key: "deactivated", label: "Deactivated" },
];

function formatDateStable(value) {
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return "N/A";
    return d.toISOString().replace("T", " ").replace("Z", "");
  } catch {
    return "N/A";
  }
}

function resolveRole(user) {
  if (user?.isadmin) return "admin";
  if (user?.canrequest) return "requester";
  return "deactivated";
}

function DashboardTable({ data, columns }) {
  const [searchValue, setSearchValue] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [rowsPerPage, setRowsPerPage] = useState(Number(ROWS_PER_PAGE_OPTIONS[0]));
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [searchValue, roleFilter, rowsPerPage]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = searchValue.trim().toLowerCase();

    return data.filter((user) => {
      const matchesSearch =
        !normalizedQuery ||
        [user.firstname, user.lastname, user.email, user.username]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedQuery));

      const matchesRole =
        roleFilter === "all" || resolveRole(user) === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [data, searchValue, roleFilter]);

  const pages = Math.max(1, Math.ceil(filteredUsers.length / rowsPerPage));
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredUsers.slice(start, start + rowsPerPage);
  }, [filteredUsers, page, rowsPerPage]);

  const renderCell = useCallback((user, columnKey) => {
    const cellValue = user[columnKey];

    if (columnKey === "creation_date" || columnKey === "change_date") {
      return cellValue ? formatDateStable(cellValue) : "N/A";
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
      case "role":
        return <span className="capitalize">{resolveRole(user)}</span>;
      case "actions":
        return (
          <div className="relative flex items-center gap-2">
            <Link href={`/user/${user.userid}/`} className="text-default-400 hover:text-default-500">
              <span className="text-lg cursor-pointer active:opacity-50">
                <EyeIcon />
              </span>
            </Link>
            <Link href={`/user/${user.userid}/edit/`} className="text-default-400 hover:text-default-500">
              <span className="text-lg cursor-pointer active:opacity-50">
                <EditIcon />
              </span>
            </Link>
            <button
              type="button"
              className="text-lg text-danger cursor-pointer active:opacity-50"
              aria-label="Delete user"
            >
              <DeleteIcon />
            </button>
          </div>
        );
      default:
        return cellValue;
    }
  }, []);

  return (
    <Table
      isStriped
      aria-label="Users table"
      selectionMode="multiple"
      topContentPlacement="outside"
      bottomContentPlacement="outside"
      topContent={
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Users</h1>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <Input
              isClearable
              className="w-full lg:max-w-md"
              placeholder="Search by name, username, or email"
              startContent={<SearchIcon />}
              value={searchValue}
              onClear={() => setSearchValue("")}
              onValueChange={setSearchValue}
            />
            <div className="flex flex-wrap gap-3">
              <Select
                aria-label="Filter by role"
                label="Role"
                selectedKeys={new Set([roleFilter])}
                disallowEmptySelection
                className="w-44"
                onSelectionChange={(keys) => {
                  const [key] = Array.from(keys);
                  setRoleFilter(key ?? "all");
                }}
              >
                {roleOptions.map((option) => (
                  <SelectItem key={option.key}>{option.label}</SelectItem>
                ))}
              </Select>
              <Button as={Link} color="primary" endContent={<PlusIcon />} href="/user/create">
                Create
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-small text-default-500">
              Showing {paginatedUsers.length} of {filteredUsers.length} users
            </span>
            <Select
              aria-label="Rows per page"
              label="Rows"
              selectedKeys={new Set([String(rowsPerPage)])}
              disallowEmptySelection
              className="w-24"
              onSelectionChange={(keys) => {
                const [key] = Array.from(keys);
                setRowsPerPage(Number(key ?? ROWS_PER_PAGE_OPTIONS[0]));
              }}
            >
              {ROWS_PER_PAGE_OPTIONS.map((option) => (
                <SelectItem key={option}>{option}</SelectItem>
              ))}
            </Select>
          </div>
        </div>
      }
      bottomContent={
        <div className="flex items-center justify-center p-2">
          <Pagination
            isDisabled={filteredUsers.length === 0}
            page={page}
            total={pages}
            showControls
            onChange={setPage}
          />
        </div>
      }
    >
      <TableHeader columns={columns}>
        {(column) => (
          <TableColumn
            key={column.uid}
            align={column.uid === "actions" ? "center" : "start"}
          >
            {column.name}
          </TableColumn>
        )}
      </TableHeader>
      <TableBody emptyContent="No users found" items={paginatedUsers}>
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
