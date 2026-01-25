"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Accessories</h1>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name, tag, manufacturer, or model"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {statuses.map((status) => (
                  <SelectItem key={String(status.statustypeid)} value={String(status.statustypeid)}>
                    {status.statustypename}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={String(category.accessoriecategorytypeid)} value={String(category.accessoriecategorytypeid)}>
                    {category.accessoriecategorytypename}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={String(location.locationid)} value={String(location.locationid)}>
                    {location.locationname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={requestableFilter} onValueChange={setRequestableFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Requestable" />
              </SelectTrigger>
              <SelectContent>
                {requestableOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild>
              <Link href="/accessories/create">
                <PlusIcon className="mr-2 h-4 w-4" />
                Create
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            Showing {paginatedItems.length} of {filteredItems.length} accessories
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
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Tag</TableHead>
              <TableHead>Manufacturer</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Requestable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center">
                  No accessories found
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((item) => (
                <TableRow key={item.accessorieid}>
                  <TableCell>{item.accessoriename}</TableCell>
                  <TableCell>{item.accessorietag}</TableCell>
                  <TableCell>{manufacturerById.get(item.manufacturerid) ?? "-"}</TableCell>
                  <TableCell>{modelById.get(item.modelid) ?? "-"}</TableCell>
                  <TableCell>
                    {statusById.get(item.statustypeid) ? (
                      <Badge>
                        {statusById.get(item.statustypeid)}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{categoryById.get(item.accessoriecategorytypeid) ?? "-"}</TableCell>
                  <TableCell>{locationById.get(item.locationid) ?? "-"}</TableCell>
                  <TableCell>{supplierById.get(item.supplierid) ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={item.requestable ? "default" : "secondary"}>
                      {item.requestable ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
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
