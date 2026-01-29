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
const expirationOptions = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "expired", label: "Expired" },
];

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

export default function LicencesTable({
  items,
  categories,
  manufacturers,
  suppliers,
}) {
  const [searchValue, setSearchValue] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [manufacturerFilter, setManufacturerFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [expirationFilter, setExpirationFilter] = useState("all");
  const [rowsPerPage, setRowsPerPage] = useState(Number(ROWS_PER_PAGE_OPTIONS[0]));
  const [page, setPage] = useState(1);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedLicence, setSelectedLicence] = useState(null);
  const [licencesData, setLicencesData] = useState(items);

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

    return licencesData.filter((item) => {
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
    licencesData,
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

  const columns = [
    { key: 'licencekey', label: 'Key' },
    { key: 'licensedtoemail', label: 'Licensed To' },
    { key: 'category', label: 'Category' },
    { key: 'manufacturer', label: 'Manufacturer' },
    { key: 'supplier', label: 'Supplier' },
    { key: 'expirationdate', label: 'Expires' },
    { key: 'actions', label: 'Actions' },
  ];

  const handleDelete = async (licenceId: string) => {
    try {
      const response = await fetch("/api/licence", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenceid: licenceId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete licence");
      }

      const result = await response.json();

      toast.success(result.message, {
        description: `${licenceId} deleted successfully`,
      });

      setLicencesData((prevItems) => prevItems.filter((item) => item.licenceid !== licenceId));
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error("Error deleting licence:", error);
      toast.error("Failed to delete licence", {
        description: error.message,
      });
    }
  };

  const renderCell = (item, columnKey) => {
    switch (columnKey) {
      case 'licencekey':
        return item.licencekey ?? "-";
      case 'licensedtoemail':
        return item.licensedtoemail ?? "-";
      case 'category':
        return categoryById.get(item.licencecategorytypeid) ?? "-";
      case 'manufacturer':
        return manufacturerById.get(item.manufacturerid) ?? "-";
      case 'supplier':
        return supplierById.get(item.supplierid) ?? "-";
      case 'expirationdate':
        return formatDate(item.expirationdate);
      case 'actions':
        return (
          <div className="flex items-center gap-2">
            <Button
              className="text-lg text-muted-foreground cursor-pointer hover:opacity-80 h-6 w-6"
              size="icon"
              variant="ghost"
              asChild
            >
              <Link href={`/licences/${item.licenceid}/edit`}>
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
                    setSelectedLicence(item);
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
          <h1 className="text-2xl font-semibold">Licences</h1>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by key, assignee, or metadata"
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
                  <SelectItem key={String(category.licencecategorytypeid)} value={String(category.licencecategorytypeid)}>
                    {category.licencecategorytypename}
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
            <Select value={expirationFilter} onValueChange={setExpirationFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                {expirationOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild>
              <Link href="/licences/create">
                <PlusIcon className="mr-2 h-4 w-4" />
                Create
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            Showing {paginatedItems.length} of {filteredItems.length} licences
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
        keyExtractor={(item) => item.licenceid}
        emptyMessage="No licences found"
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
            <DialogTitle>Delete Licence</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete licence &quot;{selectedLicence?.licencekey || selectedLicence?.licenceid}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDelete(selectedLicence?.licenceid)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

