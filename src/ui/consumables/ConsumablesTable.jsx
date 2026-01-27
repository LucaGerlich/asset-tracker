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

function formatPrice(value) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return value.toFixed(2);
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : String(value);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

export default function ConsumablesTable({
  items,
  categories,
  manufacturers,
  suppliers,
}) {
  const [searchValue, setSearchValue] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [manufacturerFilter, setManufacturerFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [rowsPerPage, setRowsPerPage] = useState(Number(ROWS_PER_PAGE_OPTIONS[0]));
  const [page, setPage] = useState(1);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.consumablecategorytypeid, c.consumablecategorytypename])),
    [categories]
  );
  const manufacturerById = useMemo(
    () => new Map(manufacturers.map((m) => [m.manufacturerid, m.manufacturername])),
    [manufacturers]
  );
  const supplierById = useMemo(
    () => new Map(suppliers.map((s) => [s.supplierid, s.suppliername])),
    [suppliers]
  );

  useEffect(() => {
    setPage(1);
  }, [searchValue, categoryFilter, manufacturerFilter, supplierFilter, rowsPerPage]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchValue.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !normalizedQuery ||
        [
          item.consumablename,
          categoryById.get(item.consumablecategorytypeid),
          manufacturerById.get(item.manufacturerid),
          supplierById.get(item.supplierid),
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedQuery));

      const matchesCategory =
        categoryFilter === "all" || String(item.consumablecategorytypeid ?? "") === categoryFilter;
      const matchesManufacturer =
        manufacturerFilter === "all" || String(item.manufacturerid ?? "") === manufacturerFilter;
      const matchesSupplier =
        supplierFilter === "all" || String(item.supplierid ?? "") === supplierFilter;

      return matchesSearch && matchesCategory && matchesManufacturer && matchesSupplier;
    });
  }, [
    items,
    searchValue,
    categoryFilter,
    manufacturerFilter,
    supplierFilter,
    categoryById,
    manufacturerById,
    supplierById,
  ]);

  const pages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredItems.slice(start, start + rowsPerPage);
  }, [filteredItems, page, rowsPerPage]);

  const columns = [
    { key: 'consumablename', label: 'Name' },
    { key: 'category', label: 'Category' },
    { key: 'manufacturer', label: 'Manufacturer' },
    { key: 'supplier', label: 'Supplier' },
    { key: 'purchaseprice', label: 'Price' },
    { key: 'purchasedate', label: 'Purchased' },
  ];

  const renderCell = (item, columnKey) => {
    switch (columnKey) {
      case 'consumablename':
        return item.consumablename;
      case 'category':
        return categoryById.get(item.consumablecategorytypeid) ?? "-";
      case 'manufacturer':
        return manufacturerById.get(item.manufacturerid) ?? "-";
      case 'supplier':
        return supplierById.get(item.supplierid) ?? "-";
      case 'purchaseprice':
        return formatPrice(item.purchaseprice);
      case 'purchasedate':
        return formatDate(item.purchasedate);
      default:
        return null;
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Consumables</h1>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name, category, manufacturer, or supplier"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={String(category.consumablecategorytypeid)} value={String(category.consumablecategorytypeid)}>
                    {category.consumablecategorytypename}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={manufacturerFilter} onValueChange={setManufacturerFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Manufacturer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {manufacturers.map((manufacturer) => (
                  <SelectItem key={String(manufacturer.manufacturerid)} value={String(manufacturer.manufacturerid)}>
                    {manufacturer.manufacturername}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={String(supplier.supplierid)} value={String(supplier.supplierid)}>
                    {supplier.suppliername}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild>
              <Link href="/consumables/create">
                <PlusIcon className="mr-2 h-4 w-4" />
                Create
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            Showing {paginatedItems.length} of {filteredItems.length} consumables
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
        keyExtractor={(item) => item.consumableid}
        emptyMessage="No consumables found"
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

