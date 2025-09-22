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

  return (
    <Table
      aria-label="Consumables table"
      isStriped
      topContentPlacement="outside"
      bottomContentPlacement="outside"
      topContent={
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Consumables</h1>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <Input
              isClearable
              className="w-full lg:max-w-md"
              placeholder="Search by name, category, manufacturer, or supplier"
              startContent={<SearchIcon />}
              value={searchValue}
              onClear={() => setSearchValue("")}
              onValueChange={setSearchValue}
            />
            <div className="flex flex-wrap gap-3">
              <Select
                aria-label="Filter by category"
                label="Category"
                selectedKeys={new Set([categoryFilter])}
                disallowEmptySelection
                className="w-48"
                onSelectionChange={(keys) => {
                  const [key] = Array.from(keys);
                  setCategoryFilter(key ?? "all");
                }}
              >
                <SelectItem key="all">All</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={String(category.consumablecategorytypeid)}>
                    {category.consumablecategorytypename}
                  </SelectItem>
                ))}
              </Select>
              <Select
                aria-label="Filter by manufacturer"
                label="Manufacturer"
                selectedKeys={new Set([manufacturerFilter])}
                disallowEmptySelection
                className="w-48"
                onSelectionChange={(keys) => {
                  const [key] = Array.from(keys);
                  setManufacturerFilter(key ?? "all");
                }}
              >
                <SelectItem key="all">All</SelectItem>
                {manufacturers.map((manufacturer) => (
                  <SelectItem key={String(manufacturer.manufacturerid)}>
                    {manufacturer.manufacturername}
                  </SelectItem>
                ))}
              </Select>
              <Select
                aria-label="Filter by supplier"
                label="Supplier"
                selectedKeys={new Set([supplierFilter])}
                disallowEmptySelection
                className="w-48"
                onSelectionChange={(keys) => {
                  const [key] = Array.from(keys);
                  setSupplierFilter(key ?? "all");
                }}
              >
                <SelectItem key="all">All</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={String(supplier.supplierid)}>
                    {supplier.suppliername}
                  </SelectItem>
                ))}
              </Select>
              <Button as={Link} color="primary" endContent={<PlusIcon />} href="/consumables/create">
                Create
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-small text-default-500">
              Showing {paginatedItems.length} of {filteredItems.length} consumables
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
        <TableColumn>Category</TableColumn>
        <TableColumn>Manufacturer</TableColumn>
        <TableColumn>Supplier</TableColumn>
        <TableColumn>Price</TableColumn>
        <TableColumn>Purchased</TableColumn>
        <TableColumn>Actions</TableColumn>
      </TableHeader>
      <TableBody emptyContent="No consumables found" items={paginatedItems}>
        {(item) => (
          <TableRow key={item.consumableid}>
            <TableCell>{item.consumablename}</TableCell>
            <TableCell>{categoryById.get(item.consumablecategorytypeid) ?? "-"}</TableCell>
            <TableCell>{manufacturerById.get(item.manufacturerid) ?? "-"}</TableCell>
            <TableCell>{supplierById.get(item.supplierid) ?? "-"}</TableCell>
            <TableCell>{formatPrice(item.purchaseprice)}</TableCell>
            <TableCell>{formatDate(item.purchasedate)}</TableCell>
            <TableCell>
              <Button
                as={Link}
                href={`/consumables/${item.consumableid}/edit`}
                size="sm"
                variant="light"
              >
                Edit
              </Button>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
