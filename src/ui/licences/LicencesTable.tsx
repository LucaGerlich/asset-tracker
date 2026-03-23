"use client";

import React, { useMemo, useState, useCallback } from "react";
import { useUrlState } from "@/hooks/useUrlState";
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
import {
  PlusIcon,
  SearchIcon,
  EditIcon,
  DeleteIcon,
  MoreVertical,
} from "../Icons";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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
  // -- URL-synced state for shareable filter / pagination URLs --
  const [urlState, setUrlState] = useUrlState({
    search: "",
    category: "all",
    manufacturer: "all",
    supplier: "all",
    expiration: "all",
    pageSize: ROWS_PER_PAGE_OPTIONS[0],
    page: "1",
  });

  // Derived values from URL state
  const searchValue = urlState.search;
  const categoryFilter = urlState.category;
  const manufacturerFilter = urlState.manufacturer;
  const supplierFilter = urlState.supplier;
  const expirationFilter = urlState.expiration;
  const rowsPerPage =
    Number(urlState.pageSize) || Number(ROWS_PER_PAGE_OPTIONS[0]);
  const page = Number(urlState.page) || 1;

  // Convenience setters that update URL state
  const setSearchValue = useCallback(
    (v: string) => setUrlState({ search: v, page: "1" }),
    [setUrlState],
  );
  const setCategoryFilter = useCallback(
    (v: string) => setUrlState({ category: v, page: "1" }),
    [setUrlState],
  );
  const setManufacturerFilter = useCallback(
    (v: string) => setUrlState({ manufacturer: v, page: "1" }),
    [setUrlState],
  );
  const setSupplierFilter = useCallback(
    (v: string) => setUrlState({ supplier: v, page: "1" }),
    [setUrlState],
  );
  const setExpirationFilter = useCallback(
    (v: string) => setUrlState({ expiration: v, page: "1" }),
    [setUrlState],
  );
  const setRowsPerPage = useCallback(
    (n: number) => setUrlState({ pageSize: String(n), page: "1" }),
    [setUrlState],
  );
  const setPage = useCallback(
    (p: number) => setUrlState({ page: String(p) }),
    [setUrlState],
  );

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedLicence, setSelectedLicence] = useState(null);
  const [licencesData, setLicencesData] = useState(items);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  const categoryById = useMemo(
    () =>
      new Map(
        categories.map((c) => [
          c.licencecategorytypeid,
          c.licencecategorytypename,
        ]),
      ),
    [categories],
  );
  const manufacturerById = useMemo(
    () =>
      new Map(manufacturers.map((m) => [m.manufacturerid, m.manufacturername])),
    [manufacturers],
  );
  const supplierById = useMemo(
    () => new Map(suppliers.map((s) => [s.supplierid, s.suppliername])),
    [suppliers],
  );

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
        categoryFilter === "all" ||
        String(item.licencecategorytypeid ?? "") === categoryFilter;
      const matchesManufacturer =
        manufacturerFilter === "all" ||
        String(item.manufacturerid ?? "") === manufacturerFilter;
      const matchesSupplier =
        supplierFilter === "all" ||
        String(item.supplierid ?? "") === supplierFilter;

      const matchesExpiration = (() => {
        if (expirationFilter === "all") return true;
        if (!item.expirationdate) return expirationFilter !== "expired";
        const expiresAt = new Date(item.expirationdate);
        if (Number.isNaN(expiresAt.getTime())) return true;
        return expirationFilter === "expired"
          ? expiresAt < now
          : expiresAt >= now;
      })();

      return (
        matchesSearch &&
        matchesCategory &&
        matchesManufacturer &&
        matchesSupplier &&
        matchesExpiration
      );
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
    { key: "licencekey", label: "Key" },
    { key: "licensedtoemail", label: "Licensed To" },
    { key: "category", label: "Category" },
    { key: "manufacturer", label: "Manufacturer" },
    { key: "supplier", label: "Supplier" },
    { key: "expirationdate", label: "Expires" },
    { key: "actions", label: "Actions", hideable: false },
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

      setLicencesData((prevItems) =>
        prevItems.filter((item) => item.licenceid !== licenceId),
      );
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error("Error deleting licence:", error);
      toast.error("Failed to delete licence", {
        description: error.message,
      });
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedKeys);
      for (const id of ids) {
        await fetch("/api/licence", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ licenceid: id }),
        });
      }
      setLicencesData((prev) =>
        prev.filter((item) => !selectedKeys.has(item.licenceid)),
      );
      toast.success(`Deleted ${ids.length} licence(s)`);
      setSelectedKeys(new Set());
      setShowBulkDelete(false);
    } catch (error) {
      toast.error("Failed to delete some licences");
    } finally {
      setBulkDeleting(false);
    }
  };

  const renderCell = (item, columnKey) => {
    switch (columnKey) {
      case "licencekey":
        return item.licencekey ?? "-";
      case "licensedtoemail":
        return item.licensedtoemail ?? "-";
      case "category":
        return categoryById.get(item.licencecategorytypeid) ?? "-";
      case "manufacturer":
        return manufacturerById.get(item.manufacturerid) ?? "-";
      case "supplier":
        return supplierById.get(item.supplierid) ?? "-";
      case "expirationdate":
        return formatDate(item.expirationdate);
      case "actions":
        return (
          <div className="flex items-center gap-2">
            <Button
              className="text-muted-foreground h-6 w-6 cursor-pointer text-lg hover:opacity-80"
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
                  className="text-muted-foreground h-6 w-6 cursor-pointer text-lg hover:opacity-80"
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
          <Button asChild>
            <Link href="/licences/create">
              <PlusIcon className="mr-2 h-4 w-4" />
              Create
            </Link>
          </Button>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              className="pl-9"
              placeholder="Search by key, assignee, or metadata"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-medium">
                Category
              </span>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem
                      key={String(category.licencecategorytypeid)}
                      value={String(category.licencecategorytypeid)}
                    >
                      {category.licencecategorytypename}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-medium">
                Manufacturer
              </span>
              <Select
                value={manufacturerFilter}
                onValueChange={setManufacturerFilter}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Manufacturers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Manufacturers</SelectItem>
                  {manufacturers.map((manufacturer) => (
                    <SelectItem
                      key={String(manufacturer.manufacturerid)}
                      value={String(manufacturer.manufacturerid)}
                    >
                      {manufacturer.manufacturername}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-medium">
                Supplier
              </span>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Suppliers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem
                      key={String(supplier.supplierid)}
                      value={String(supplier.supplierid)}
                    >
                      {supplier.suppliername}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-medium">
                State
              </span>
              <Select
                value={expirationFilter}
                onValueChange={setExpirationFilter}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent>
                  {expirationOptions.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-muted-foreground text-sm">
            Showing {paginatedItems.length} of {filteredItems.length} licences
          </span>
          <Select
            value={String(rowsPerPage)}
            onValueChange={(value) => setRowsPerPage(Number(value))}
          >
            <SelectTrigger className="w-24">
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
      </div>
      <ResponsiveTable
        columns={columns}
        data={paginatedItems}
        renderCell={renderCell}
        keyExtractor={(item) => item.licenceid}
        emptyMessage="No licences found"
        mobileCardView={true}
        storageKey="columns:licences"
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        bulkActions={
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowBulkDelete(true)}
          >
            Delete ({selectedKeys.size})
          </Button>
        }
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
              Are you sure you want to delete licence &quot;
              {selectedLicence?.licencekey || selectedLicence?.licenceid}&quot;?
              This action cannot be undone.
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

      <ConfirmDialog
        open={showBulkDelete}
        onOpenChange={setShowBulkDelete}
        title={`Delete ${selectedKeys.size} licence(s)?`}
        description="This will permanently delete the selected licences. This cannot be undone."
        confirmLabel="Delete All"
        onConfirm={handleBulkDelete}
        loading={bulkDeleting}
      />
    </div>
  );
}
