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

export default function ManufacturersTable({ items }) {
  const [searchValue, setSearchValue] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [rowsPerPage, setRowsPerPage] = useState(Number(ROWS_PER_PAGE_OPTIONS[0]));
  const [page, setPage] = useState(1);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedManufacturer, setSelectedManufacturer] = useState(null);
  const [manufacturersData, setManufacturersData] = useState(items);

  const years = useMemo(() => {
    const unique = new Set<number>(
      manufacturersData
        .map((item) => getYear(item.creation_date))
        .filter((year): year is number => typeof year === "number")
    );
    return Array.from(unique).sort((a, b) => b - a);
  }, [manufacturersData]);

  useEffect(() => {
    setPage(1);
  }, [searchValue, yearFilter, rowsPerPage]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchValue.trim().toLowerCase();

    return manufacturersData.filter((item) => {
      const matchesSearch =
        !normalizedQuery || (item.manufacturername ?? "").toLowerCase().includes(normalizedQuery);

      const matchesYear =
        yearFilter === "all" || String(getYear(item.creation_date) ?? "") === yearFilter;

      return matchesSearch && matchesYear;
    });
  }, [manufacturersData, searchValue, yearFilter]);

  const pages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredItems.slice(start, start + rowsPerPage);
  }, [filteredItems, page, rowsPerPage]);

  const columns = [
    { key: 'manufacturername', label: 'Name' },
    { key: 'creation_date', label: 'Created' },
    { key: 'actions', label: 'Actions' },
  ];

  const handleDelete = async (manufacturerId: string) => {
    try {
      const response = await fetch("/api/manufacturer", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manufacturerid: manufacturerId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete manufacturer");
      }

      const result = await response.json();

      toast.success(result.message, {
        description: `${manufacturerId} deleted successfully`,
      });

      setManufacturersData((prevItems) => prevItems.filter((item) => item.manufacturerid !== manufacturerId));
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error("Error deleting manufacturer:", error);
      toast.error("Failed to delete manufacturer", {
        description: error.message,
      });
    }
  };

  const renderCell = (item, columnKey) => {
    switch (columnKey) {
      case 'manufacturername':
        return item.manufacturername;
      case 'creation_date':
        return formatDate(item.creation_date);
      case 'actions':
        return (
          <div className="flex items-center gap-2">
            <Button
              className="text-lg text-muted-foreground cursor-pointer hover:opacity-80 h-6 w-6"
              size="icon"
              variant="ghost"
              asChild
            >
              <Link href={`/manufacturers/${item.manufacturerid}/edit`}>
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
                    setSelectedManufacturer(item);
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
          <h1 className="text-2xl font-semibold">Manufacturers</h1>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search manufacturers"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3">
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
              <Link href="/manufacturers/create">
                <PlusIcon className="mr-2 h-4 w-4" />
                Create
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            Showing {paginatedItems.length} of {filteredItems.length} manufacturers
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
        keyExtractor={(item) => item.manufacturerid}
        emptyMessage="No manufacturers found"
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
            <DialogTitle>Delete Manufacturer</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete manufacturer &quot;{selectedManufacturer?.manufacturername}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDelete(selectedManufacturer?.manufacturerid)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

