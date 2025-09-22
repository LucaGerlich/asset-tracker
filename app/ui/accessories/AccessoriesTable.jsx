"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Button,
  Chip,
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

const requestableOptions = [
  { key: "all", label: "All" },
  { key: "yes", label: "Requestable" },
  { key: "no", label: "Not Requestable" },
];

export default function AccessoriesTable({
  items,
  manufacturers,
  models,
  statuses,
  categories,
  locations,
  suppliers,
}) {
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [requestableFilter, setRequestableFilter] = useState("all");
  const [rowsPerPage, setRowsPerPage] = useState(Number(ROWS_PER_PAGE_OPTIONS[0]));
  const [page, setPage] = useState(1);

  const manufacturerById = useMemo(
    () => new Map(manufacturers.map((m) => [m.manufacturerid, m.manufacturername])),
    [manufacturers]
  );
  const modelById = useMemo(
    () => new Map(models.map((m) => [m.modelid, m.modelname])),
    [models]
  );
  const statusById = useMemo(
    () => new Map(statuses.map((s) => [s.statustypeid, s.statustypename])),
    [statuses]
  );
  const categoryById = useMemo(
    () =>
      new Map(
        categories.map((c) => [c.accessoriecategorytypeid, c.accessoriecategorytypename])
      ),
    [categories]
  );
  const locationById = useMemo(
    () => new Map(locations.map((l) => [l.locationid, l.locationname])),
    [locations]
  );
  const supplierById = useMemo(
    () => new Map(suppliers.map((s) => [s.supplierid, s.suppliername])),
    [suppliers]
  );

  useEffect(() => {
    setPage(1);
  }, [searchValue, statusFilter, categoryFilter, locationFilter, requestableFilter, rowsPerPage]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchValue.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !normalizedQuery ||
        [item.accessoriename, item.accessorietag, manufacturerById.get(item.manufacturerid), modelById.get(item.modelid)]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedQuery));

      const matchesStatus =
        statusFilter === "all" || String(item.statustypeid ?? "") === statusFilter;

      const matchesCategory =
        categoryFilter === "all" || String(item.accessoriecategorytypeid ?? "") === categoryFilter;

      const matchesLocation =
        locationFilter === "all" || String(item.locationid ?? "") === locationFilter;

      const matchesRequestable =
        requestableFilter === "all" ||
        (requestableFilter === "yes" && item.requestable) ||
        (requestableFilter === "no" && !item.requestable);

      return matchesSearch && matchesStatus && matchesCategory && matchesLocation && matchesRequestable;
    });
  }, [
    items,
    searchValue,
    statusFilter,
    categoryFilter,
    locationFilter,
    requestableFilter,
    manufacturerById,
    modelById,
  ]);

  const pages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredItems.slice(start, start + rowsPerPage);
  }, [filteredItems, page, rowsPerPage]);

  return (
    <Table
      aria-label="Accessories table"
      isStriped
      topContentPlacement="outside"
      bottomContentPlacement="outside"
      topContent={
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Accessories</h1>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <Input
              isClearable
              className="w-full lg:max-w-md"
              placeholder="Search by name, tag, manufacturer, or model"
              startContent={<SearchIcon />}
              value={searchValue}
              onClear={() => setSearchValue("")}
              onValueChange={setSearchValue}
            />
            <div className="flex flex-wrap gap-3">
              <Select
                aria-label="Filter by status"
                label="Status"
                selectedKeys={new Set([statusFilter])}
                selectionMode="single"
                disallowEmptySelection
                className="w-40"
                onSelectionChange={(keys) => {
                  const [key] = Array.from(keys);
                  setStatusFilter(key ?? "all");
                }}
              >
                <SelectItem key="all">All</SelectItem>
                {statuses.map((status) => (
                  <SelectItem key={String(status.statustypeid)}>
                    {status.statustypename}
                  </SelectItem>
                ))}
              </Select>
              <Select
                aria-label="Filter by category"
                label="Category"
                selectedKeys={new Set([categoryFilter])}
                disallowEmptySelection
                className="w-44"
                onSelectionChange={(keys) => {
                  const [key] = Array.from(keys);
                  setCategoryFilter(key ?? "all");
                }}
              >
                <SelectItem key="all">All</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={String(category.accessoriecategorytypeid)}>
                    {category.accessoriecategorytypename}
                  </SelectItem>
                ))}
              </Select>
              <Select
                aria-label="Filter by location"
                label="Location"
                selectedKeys={new Set([locationFilter])}
                disallowEmptySelection
                className="w-44"
                onSelectionChange={(keys) => {
                  const [key] = Array.from(keys);
                  setLocationFilter(key ?? "all");
                }}
              >
                <SelectItem key="all">All</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={String(location.locationid)}>
                    {location.locationname}
                  </SelectItem>
                ))}
              </Select>
              <Select
                aria-label="Filter by requestable"
                label="Requestable"
                selectedKeys={new Set([requestableFilter])}
                disallowEmptySelection
                className="w-40"
                onSelectionChange={(keys) => {
                  const [key] = Array.from(keys);
                  setRequestableFilter(key ?? "all");
                }}
              >
                {requestableOptions.map((option) => (
                  <SelectItem key={option.key}>{option.label}</SelectItem>
                ))}
              </Select>
              <Button as={Link} color="primary" endContent={<PlusIcon />} href="/accessories/create">
                Create
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-small text-default-500">
              Showing {paginatedItems.length} of {filteredItems.length} accessories
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
        <TableColumn>Tag</TableColumn>
        <TableColumn>Manufacturer</TableColumn>
        <TableColumn>Model</TableColumn>
        <TableColumn>Status</TableColumn>
        <TableColumn>Category</TableColumn>
        <TableColumn>Location</TableColumn>
        <TableColumn>Supplier</TableColumn>
        <TableColumn>Requestable</TableColumn>
        <TableColumn>Actions</TableColumn>
      </TableHeader>
      <TableBody emptyContent="No accessories found" items={paginatedItems}>
        {(item) => (
          <TableRow key={item.accessorieid}>
            <TableCell>{item.accessoriename}</TableCell>
            <TableCell>{item.accessorietag}</TableCell>
            <TableCell>{manufacturerById.get(item.manufacturerid) ?? "-"}</TableCell>
            <TableCell>{modelById.get(item.modelid) ?? "-"}</TableCell>
            <TableCell>
              {statusById.get(item.statustypeid) ? (
                <Chip size="sm" color="primary" variant="flat">
                  {statusById.get(item.statustypeid)}
                </Chip>
              ) : (
                "-"
              )}
            </TableCell>
            <TableCell>{categoryById.get(item.accessoriecategorytypeid) ?? "-"}</TableCell>
            <TableCell>{locationById.get(item.locationid) ?? "-"}</TableCell>
            <TableCell>{supplierById.get(item.supplierid) ?? "-"}</TableCell>
            <TableCell>
              <Chip
                size="sm"
                variant="flat"
                color={item.requestable ? "success" : "default"}
              >
                {item.requestable ? "Yes" : "No"}
              </Chip>
            </TableCell>
            <TableCell>
              <Button
                as={Link}
                href={`/accessories/${item.accessorieid}/edit`}
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
