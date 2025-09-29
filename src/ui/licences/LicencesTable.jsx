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
import { formatDateISO } from "@/utils/utils";
import { usePersistentState } from "@/hooks/usePersistentState";

const ROWS_PER_PAGE_OPTIONS = ["10", "20", "50", "100"];
const expirationOptions = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "expired", label: "Expired" },
];

export default function LicencesTable({
  items,
  categories,
  manufacturers,
  suppliers,
}) {
  const [searchValue, setSearchValue] = usePersistentState("filters:licences:search", "");
  const [categoryFilter, setCategoryFilter] = usePersistentState(
    "filters:licences:category",
    "all"
  );
  const [manufacturerFilter, setManufacturerFilter] = usePersistentState(
    "filters:licences:manufacturer",
    "all"
  );
  const [supplierFilter, setSupplierFilter] = usePersistentState(
    "filters:licences:supplier",
    "all"
  );
  const [expirationFilter, setExpirationFilter] = usePersistentState(
    "filters:licences:expiration",
    "all"
  );
  const [rowsPerPage, setRowsPerPage] = usePersistentState(
    "filters:licences:rowsPerPage",
    Number(ROWS_PER_PAGE_OPTIONS[0])
  );
  const [page, setPage] = useState(1);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.licencecategorytypeid, c.licencecategorytypename])),
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
  }, [searchValue, categoryFilter, manufacturerFilter, supplierFilter, expirationFilter, rowsPerPage]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchValue.trim().toLowerCase();
    const now = new Date();

    return items.filter((item) => {
      const matchesSearch =
        !normalizedQuery ||
        [
          item.licencekey,
          item.licensedtoemail,
          categoryById.get(item.licencecategorytypeid),
          manufacturerById.get(item.manufacturerid),
          supplierById.get(item.supplierid),
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedQuery));

      const matchesCategory =
        categoryFilter === "all" || String(item.licencecategorytypeid ?? "") === categoryFilter;
      const matchesManufacturer =
        manufacturerFilter === "all" || String(item.manufacturerid ?? "") === manufacturerFilter;
      const matchesSupplier =
        supplierFilter === "all" || String(item.supplierid ?? "") === supplierFilter;

      const matchesExpiration = (() => {
        if (expirationFilter === "all") return true;
        if (!item.expirationdate) return expirationFilter !== "expired";
        const expiresAt = new Date(item.expirationdate);
        if (Number.isNaN(expiresAt.getTime())) return true;
        return expirationFilter === "expired" ? expiresAt < now : expiresAt >= now;
      })();

      return matchesSearch && matchesCategory && matchesManufacturer && matchesSupplier && matchesExpiration;
    });
  }, [
    items,
    searchValue,
    categoryFilter,
    manufacturerFilter,
    supplierFilter,
    expirationFilter,
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
      aria-label="Licences table"
      isStriped
      topContentPlacement="outside"
      bottomContentPlacement="outside"
      topContent={
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Licences</h1>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <Input
              isClearable
              className="w-full lg:max-w-md"
              placeholder="Search by key, assignee, or metadata"
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
                  <SelectItem key={String(category.licencecategorytypeid)}>
                    {category.licencecategorytypename}
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
              <Select
                aria-label="Filter by expiration"
                label="State"
                selectedKeys={new Set([expirationFilter])}
                disallowEmptySelection
                className="w-32"
                onSelectionChange={(keys) => {
                  const [key] = Array.from(keys);
                  setExpirationFilter(key ?? "all");
                }}
              >
                {expirationOptions.map((option) => (
                  <SelectItem key={option.key}>{option.label}</SelectItem>
                ))}
              </Select>
              <Button as={Link} color="primary" endContent={<PlusIcon />} href="/licences/create">
                Create
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-small text-default-500">
              Showing {paginatedItems.length} of {filteredItems.length} licences
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
        <TableColumn>Key</TableColumn>
        <TableColumn>Licensed To</TableColumn>
        <TableColumn>Category</TableColumn>
        <TableColumn>Manufacturer</TableColumn>
        <TableColumn>Supplier</TableColumn>
        <TableColumn>Expires</TableColumn>
        <TableColumn>Actions</TableColumn>
      </TableHeader>
      <TableBody emptyContent="No licences found" items={paginatedItems}>
        {(item) => (
          <TableRow key={item.licenceid}>
            <TableCell>{item.licencekey ?? "-"}</TableCell>
            <TableCell>{item.licensedtoemail ?? "-"}</TableCell>
            <TableCell>{categoryById.get(item.licencecategorytypeid) ?? "-"}</TableCell>
            <TableCell>{manufacturerById.get(item.manufacturerid) ?? "-"}</TableCell>
            <TableCell>{supplierById.get(item.supplierid) ?? "-"}</TableCell>
            <TableCell>{formatDateISO(item.expirationdate)}</TableCell>
            <TableCell>
              <Button
                as={Link}
                href={`/licences/${item.licenceid}/edit`}
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
