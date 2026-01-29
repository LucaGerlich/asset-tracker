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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { PlusIcon, SearchIcon, EditIcon, DeleteIcon, MoreVertical } from "../Icons";
import { toast } from "sonner";

const ROWS_PER_PAGE_OPTIONS = ["10", "20", "50", "100"];

export default function LocationsTable({ items }) {
  const [searchValue, setSearchValue] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [rowsPerPage, setRowsPerPage] = useState(Number(ROWS_PER_PAGE_OPTIONS[0]));
  const [page, setPage] = useState(1);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationsData, setLocationsData] = useState(items);

  const countries = useMemo(() => {
    const unique = new Set<string>(
      locationsData
        .map((item) => item.country)
        .filter((country): country is string => typeof country === 'string' && country.trim().length > 0)
    );
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [locationsData]);

  useEffect(() => {
    setPage(1);
  }, [searchValue, countryFilter, rowsPerPage]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchValue.trim().toLowerCase();

    return locationsData.filter((item) => {
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
  }, [locationsData, searchValue, countryFilter]);

  const pages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredItems.slice(start, start + rowsPerPage);
  }, [filteredItems, page, rowsPerPage]);

  const columns = [
    { key: 'locationname', label: 'Name' },
    { key: 'street', label: 'Street' },
    { key: 'city', label: 'City' },
    { key: 'country', label: 'Country' },
    { key: 'actions', label: 'Actions' },
  ];

  const handleDelete = async (locationId: string) => {
    try {
      const response = await fetch("/api/location", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationid: locationId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete location");
      }

      const result = await response.json();

      toast.success(result.message, {
        description: `${locationId} deleted successfully`,
      });

      setLocationsData((prevItems) => prevItems.filter((item) => item.locationid !== locationId));
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error("Error deleting location:", error);
      toast.error("Failed to delete location", {
        description: error.message,
      });
    }
  };

  const renderCell = (item, columnKey) => {
    switch (columnKey) {
      case 'locationname':
        return item.locationname;
      case 'street':
        return item.street ? `${item.street} ${item.housenumber ?? ""}`.trim() : "-";
      case 'city':
        return item.city ?? "-";
      case 'country':
        return item.country ?? "-";
      case 'actions':
        return (
          <div className="flex items-center gap-2">
            <Button
              className="text-lg text-muted-foreground cursor-pointer hover:opacity-80 h-6 w-6"
              size="icon"
              variant="ghost"
              asChild
            >
              <Link href={`/locations/${item.locationid}/edit`}>
                <EditIcon />
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="text-lg text-muted-foreground cursor-pointer hover:opacity-80 h-6 w-6"
                  size="icon"
                  variant="ghost"
                >
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => {
                    setSelectedLocation(item);
                    setIsDeleteModalOpen(true);
                  }}
                >
                  <DeleteIcon className="mr-2 h-4 w-4" />
                  Delete Item
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Locations</h1>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name or address details"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {countries.map((country) => (
                  <SelectItem key={country} value={country}>{country}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild>
              <Link href="/locations/create">
                <PlusIcon className="mr-2 h-4 w-4" />
                Create
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            Showing {paginatedItems.length} of {filteredItems.length} locations
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
        keyExtractor={(item) => item.locationid}
        emptyMessage="No locations found"
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

      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Location</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete location &quot;{selectedLocation?.locationname}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDelete(selectedLocation?.locationid)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

