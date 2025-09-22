"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import { PlusIcon, SearchIcon } from "../Icons";

const ROWS_PER_PAGE_OPTIONS = ["10", "20", "50", "100"];
const contactOptions = [
  { key: "all", label: "All" },
  { key: "with", label: "Has Contact" },
  { key: "without", label: "No Contact" },
];

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

function getYear(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getFullYear();
}

export default function SuppliersTable({ items }) {
  const [searchValue, setSearchValue] = useState("");
  const [contactFilter, setContactFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [rowsPerPage, setRowsPerPage] = useState(Number(ROWS_PER_PAGE_OPTIONS[0]));
  const [page, setPage] = useState(1);

  const years = useMemo(() => {
    const unique = new Set(
      items
        .map((item) => getYear(item.creation_date))
        .filter((year) => typeof year === "number")
    );
    return Array.from(unique).sort((a, b) => b - a);
  }, [items]);

  useEffect(() => {
    setPage(1);
  }, [searchValue, contactFilter, yearFilter, rowsPerPage]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchValue.trim().toLowerCase();

    return items.filter((item) => {
      const fullName = `${item.firstname ?? ""} ${item.lastname ?? ""}`.trim();
      const matchesSearch =
        !normalizedQuery ||
        [item.suppliername, fullName, item.email, item.phonenumber]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedQuery));

      const hasContact = Boolean(fullName || item.email || item.phonenumber);
      const matchesContact =
        contactFilter === "all" ||
        (contactFilter === "with" && hasContact) ||
        (contactFilter === "without" && !hasContact);

      const matchesYear =
        yearFilter === "all" || String(getYear(item.creation_date) ?? "") === yearFilter;

      return matchesSearch && matchesContact && matchesYear;
    });
  }, [items, searchValue, contactFilter, yearFilter]);

  const pages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredItems.slice(start, start + rowsPerPage);
  }, [filteredItems, page, rowsPerPage]);

  return (
    <Table
      aria-label="Suppliers table"
      isStriped
      topContentPlacement="outside"
      bottomContentPlacement="outside"
      topContent={
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Suppliers</h1>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <Input
              isClearable
              className="w-full lg:max-w-md"
              placeholder="Search suppliers and contacts"
              startContent={<SearchIcon />}
              value={searchValue}
              onClear={() => setSearchValue("")}
              onValueChange={setSearchValue}
            />
            <div className="flex flex-wrap gap-3">
              <Select
                aria-label="Filter by contact details"
                label="Contact"
                selectedKeys={new Set([contactFilter])}
                disallowEmptySelection
                className="w-40"
                onSelectionChange={(keys) => {
                  const [key] = Array.from(keys);
                  setContactFilter(key ?? "all");
                }}
              >
                {contactOptions.map((option) => (
                  <SelectItem key={option.key}>{option.label}</SelectItem>
                ))}
              </Select>
              <Select
                aria-label="Filter by creation year"
                label="Created"
                selectedKeys={new Set([yearFilter])}
                disallowEmptySelection
                className="w-40"
                onSelectionChange={(keys) => {
                  const [key] = Array.from(keys);
                  setYearFilter(key ?? "all");
                }}
              >
                <SelectItem key="all">All years</SelectItem>
                {years.map((year) => (
                  <SelectItem key={String(year)}>{year}</SelectItem>
                ))}
              </Select>
              <Button as={Link} color="primary" endContent={<PlusIcon />} href="/suppliers/create">
                Create
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-small text-default-500">
              Showing {paginatedItems.length} of {filteredItems.length} suppliers
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
            isDisabled={filteredItems.length === 0}
            page={page}
            total={pages}
            showControls
            onChange={setPage}
          />
        </div>
      }
    >
      <TableHeader>
        <TableColumn>Name</TableColumn>
        <TableColumn>Contact</TableColumn>
        <TableColumn>Email</TableColumn>
        <TableColumn>Phone</TableColumn>
        <TableColumn>Created</TableColumn>
        <TableColumn>Actions</TableColumn>
      </TableHeader>
      <TableBody emptyContent="No suppliers found" items={paginatedItems}>
        {(item) => {
          const fullName = `${item.firstname ?? ""} ${item.lastname ?? ""}`.trim();
          return (
            <TableRow key={item.supplierid}>
              <TableCell>{item.suppliername}</TableCell>
              <TableCell>{fullName || "-"}</TableCell>
              <TableCell>{item.email ?? "-"}</TableCell>
              <TableCell>{item.phonenumber ?? "-"}</TableCell>
              <TableCell>{formatDate(item.creation_date)}</TableCell>
              <TableCell>
                <Button
                  as={Link}
                  href={`/suppliers/${item.supplierid}/edit`}
                  size="sm"
                  variant="light"
                >
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          );
        }}
      </TableBody>
    </Table>
  );
}
