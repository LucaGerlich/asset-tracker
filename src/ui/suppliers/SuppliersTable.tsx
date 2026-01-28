"use client";

import React, { useEffect, useMemo, useState } from "react";
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
    const unique = new Set<number>(
      items
        .map((item) => getYear(item.creation_date))
        .filter((year): year is number => typeof year === "number")
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

  const columns = [
    { key: 'suppliername', label: 'Name' },
    { key: 'contact', label: 'Contact' },
    { key: 'email', label: 'Email' },
    { key: 'phonenumber', label: 'Phone' },
    { key: 'creation_date', label: 'Created' },
  ];

  const renderCell = (item, columnKey) => {
    switch (columnKey) {
      case 'suppliername':
        return item.suppliername;
      case 'contact':
        const fullName = `${item.firstname ?? ""} ${item.lastname ?? ""}`.trim();
        return fullName || "-";
      case 'email':
        return item.email ?? "-";
      case 'phonenumber':
        return item.phonenumber ?? "-";
      case 'creation_date':
        return formatDate(item.creation_date);
      default:
        return null;
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Suppliers</h1>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search suppliers and contacts"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={contactFilter} onValueChange={setContactFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Contact" />
              </SelectTrigger>
              <SelectContent>
                {contactOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Created" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {years.map((year) => (
                  <SelectItem key={String(year)} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild>
              <Link href="/suppliers/create">
                <PlusIcon className="mr-2 h-4 w-4" />
                Create
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            Showing {paginatedItems.length} of {filteredItems.length} suppliers
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
        data={paginatedItems}
        renderCell={renderCell}
        keyExtractor={(item) => item.supplierid}
        emptyMessage="No suppliers found"
        mobileCardView={true}
      />
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1 || filteredItems.length === 0}
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
          disabled={page === pages || filteredItems.length === 0}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

