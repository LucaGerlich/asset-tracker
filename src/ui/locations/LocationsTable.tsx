"use client";

import React, { useMemo, useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PlusIcon,
  SearchIcon,
  EditIcon,
  DeleteIcon,
  MoreVertical,
} from "../Icons";
import { ChevronRight, MapPin } from "lucide-react";
import { toast } from "sonner";

const ROWS_PER_PAGE_OPTIONS = ["10", "20", "50", "100"];

export default function LocationsTable({ items }) {
  const [searchValue, setSearchValue] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [rowsPerPage, setRowsPerPage] = useState(
    Number(ROWS_PER_PAGE_OPTIONS[0]),
  );
  const [page, setPage] = useState(1);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationsData, setLocationsData] = useState(items);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleExpand = (locationId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(locationId)) {
        next.delete(locationId);
      } else {
        next.add(locationId);
      }
      return next;
    });
  };

  const countries = useMemo(() => {
    const unique = new Set<string>(
      locationsData
        .map((item) => item.country)
        .filter(
          (country): country is string =>
            typeof country === "string" && country.trim().length > 0,
        ),
    );
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [locationsData]);

  const childrenMap = useMemo(() => {
    const map = new Map<string, typeof locationsData>();
    for (const loc of locationsData) {
      if (loc.parentId) {
        const existing = map.get(loc.parentId) || [];
        existing.push(loc);
        map.set(loc.parentId, existing);
      }
    }
    return map;
  }, [locationsData]);

  // Filter: show only top-level locations (no parentId), unless searching
  const filteredItems = useMemo(() => {
    const normalizedQuery = searchValue.trim().toLowerCase();
    const isSearching = normalizedQuery.length > 0;

    return locationsData.filter((item) => {
      // When not searching, only show top-level locations (children shown via expand)
      if (!isSearching && item.parentId) return false;

      const matchesSearch =
        !normalizedQuery ||
        [item.locationname, item.street, item.housenumber, item.city]
          .filter(Boolean)
          .some((value) =>
            value.toString().toLowerCase().includes(normalizedQuery),
          );

      const matchesCountry =
        countryFilter === "all" ||
        (item.country ?? "").toLowerCase() === countryFilter.toLowerCase();

      return matchesSearch && matchesCountry;
    });
  }, [locationsData, searchValue, countryFilter]);

  const pages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredItems.slice(start, start + rowsPerPage);
  }, [filteredItems, page, rowsPerPage]);

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

      setLocationsData((prevItems) =>
        prevItems.filter((item) => item.locationid !== locationId),
      );
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error("Error deleting location:", error);
      toast.error("Failed to delete location", {
        description: error.message,
      });
    }
  };

  const renderActions = (item) => (
    <div className="flex items-center gap-1">
      <Button
        className="text-muted-foreground h-7 w-7 cursor-pointer hover:opacity-80"
        size="icon"
        variant="ghost"
        asChild
      >
        <Link href={`/locations/${item.locationid}/edit`}>
          <EditIcon className="h-4 w-4" />
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="text-muted-foreground h-7 w-7 cursor-pointer hover:opacity-80"
            size="icon"
            variant="ghost"
          >
            <MoreVertical className="h-4 w-4" />
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
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const renderLocationRow = (item, depth = 0) => {
    const children = childrenMap.get(item.locationid) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedRows.has(item.locationid);

    return (
      <React.Fragment key={item.locationid}>
        <TableRow className={depth > 0 ? "bg-muted/30" : ""}>
          <TableCell>
            <div
              className="flex items-center gap-2"
              style={{ paddingLeft: `${depth * 24}px` }}
            >
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(item.locationid)}
                  className="hover:bg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded"
                >
                  <ChevronRight
                    className={`text-muted-foreground h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  />
                </button>
              ) : (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                  <MapPin className="text-muted-foreground/50 h-3.5 w-3.5" />
                </span>
              )}
              <span className={depth === 0 && hasChildren ? "font-medium" : ""}>
                {item.locationname ?? "(unnamed)"}
              </span>
              {hasChildren && (
                <span className="text-muted-foreground text-xs">
                  ({children.length})
                </span>
              )}
            </div>
          </TableCell>
          <TableCell>
            {item.street
              ? `${item.street} ${item.housenumber ?? ""}`.trim()
              : "-"}
          </TableCell>
          <TableCell>{item.city ?? "-"}</TableCell>
          <TableCell>{item.country ?? "-"}</TableCell>
          <TableCell>{renderActions(item)}</TableCell>
        </TableRow>
        {isExpanded &&
          children.map((child) => renderLocationRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Locations</h1>
        <Button asChild>
          <Link href="/locations/create">
            <PlusIcon className="mr-2 h-4 w-4" />
            Create
          </Link>
        </Button>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search by name or address details"
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={countryFilter}
          onValueChange={(v) => {
            setCountryFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            {countries.map((country) => (
              <SelectItem key={country} value={country}>
                {country}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">
          {filteredItems.length} locations
        </span>
        <Select
          value={String(rowsPerPage)}
          onValueChange={(value) => {
            setRowsPerPage(Number(value));
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROWS_PER_PAGE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tree table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Street</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Country</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground h-24 text-center"
                >
                  No locations found
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((item) => renderLocationRow(item))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
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

      {/* Delete confirmation */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Location</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete location &quot;
              {selectedLocation?.locationname}&quot;? This action cannot be
              undone.
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
