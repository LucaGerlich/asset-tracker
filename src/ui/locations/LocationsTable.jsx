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

export default function LocationsTable({ items }) {
  const [searchValue, setSearchValue] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [rowsPerPage, setRowsPerPage] = useState(Number(ROWS_PER_PAGE_OPTIONS[0]));
  const [page, setPage] = useState(1);

  const countries = useMemo(() => {
    const unique = new Set(
      items
        .map((item) => item.country)
        .filter((country) => country && country.trim().length > 0)
    );
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [items]);

  useEffect(() => {
    setPage(1);
  }, [searchValue, countryFilter, rowsPerPage]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchValue.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !normalizedQuery ||
        [
          item.locationname,
          item.street,
          item.housenumber,
          item.city,
          item.postalcode,
        ]
          .filter(Boolean)
          .some((value) => value.toString().toLowerCase().includes(normalizedQuery));

      const matchesCountry =
        countryFilter === "all" || (item.country ?? "").toLowerCase() === countryFilter.toLowerCase();

      return matchesSearch && matchesCountry;
    });
  }, [items, searchValue, countryFilter]);

  const pages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredItems.slice(start, start + rowsPerPage);
  }, [filteredItems, page, rowsPerPage]);

  return (
    <Table
      aria-label="Locations table"
      isStriped
      topContentPlacement="outside"
      bottomContentPlacement="outside"
      topContent={
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Locations</h1>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <Input
              isClearable
              className="w-full lg:max-w-md"
              placeholder="Search by name or address details"
              startContent={<SearchIcon />}
              value={searchValue}
              onClear={() => setSearchValue("")}
              onValueChange={setSearchValue}
            />
            <div className="flex flex-wrap gap-3">
              <Select
                aria-label="Filter by country"
                label="Country"
                selectedKeys={new Set([countryFilter])}
                disallowEmptySelection
                className="w-48"
                onSelectionChange={(keys) => {
                  const [key] = Array.from(keys);
                  setCountryFilter(key ?? "all");
                }}
              >
                <SelectItem key="all">All</SelectItem>
                {countries.map((country) => (
                  <SelectItem key={country}>{country}</SelectItem>
                ))}
              </Select>
              <Button as={Link} color="primary" endContent={<PlusIcon />} href="/locations/create">
                Create
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-small text-default-500">
              Showing {paginatedItems.length} of {filteredItems.length} locations
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
        <TableColumn>Street</TableColumn>
        <TableColumn>City</TableColumn>
        <TableColumn>Country</TableColumn>
        <TableColumn>Actions</TableColumn>
      </TableHeader>
      <TableBody emptyContent="No locations found" items={paginatedItems}>
        {(item) => (
          <TableRow key={item.locationid}>
            <TableCell>{item.locationname}</TableCell>
            <TableCell>
              {item.street ? `${item.street} ${item.housenumber ?? ""}`.trim() : "-"}
            </TableCell>
            <TableCell>{item.city ?? "-"}</TableCell>
            <TableCell>{item.country ?? "-"}</TableCell>
            <TableCell>
              <Button
                as={Link}
                href={`/locations/${item.locationid}/edit`}
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
