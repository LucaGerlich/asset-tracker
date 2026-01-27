"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { EditIcon, DeleteIcon, EyeIcon, PlusIcon, SearchIcon } from "../Icons";

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

function DashboardTable({ data, columns: propColumns }) {
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

  // Map columns from props to ResponsiveTable format
  const columns = useMemo(() => 
    propColumns.map((col: { uid: string; name: string }) => ({
      key: col.uid,
      label: col.name,
    })),
    [propColumns]
  );

  const renderCell = useCallback((user: Record<string, unknown>, columnKey: string) => {
    const cellValue = user[columnKey];

    if (columnKey === "creation_date" || columnKey === "change_date") {
      return cellValue ? formatDateStable(cellValue as string) : "N/A";
    }

    switch (columnKey) {
      case "firstName":
        return <span>{String(user.firstname ?? "")}</span>;
      case "lastName":
        return <span>{String(user.lastname ?? "")}</span>;
      case "email":
        return (
          <div className="flex flex-col">
            <span className="text-bold text-sm">{String(user.email ?? "")}</span>
          </div>
        );
      case "userName":
        return <span>{String(user.username ?? "")}</span>;
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
        return cellValue != null ? String(cellValue) : "";
    }
  }, []);

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Users</h1>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name, username, or email"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild>
              <Link href="/user/create">
                <PlusIcon className="mr-2 h-4 w-4" />
                Create
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            Showing {paginatedUsers.length} of {filteredUsers.length} users
          </span>
          <Select value={String(rowsPerPage)} onValueChange={(value) => setRowsPerPage(Number(value))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROWS_PER_PAGE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <ResponsiveTable
        columns={columns}
        data={paginatedUsers}
        renderCell={renderCell}
        keyExtractor={(item) => (item as Record<string, unknown>).userid as number}
        emptyMessage="No users found"
        mobileCardView={true}
      />
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1 || filteredUsers.length === 0}
        >
          Previous
        </Button>
        <span className="text-sm">
          Page {page} of {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(Math.min(pages, page + 1))}
          disabled={page === pages || filteredUsers.length === 0}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export default DashboardTable;
