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
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  PlusIcon,
  SearchIcon,
  EditIcon,
  DeleteIcon,
  MoreVertical,
} from "../Icons";
import { toast } from "sonner";

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
  // -- URL-synced state for shareable filter / pagination URLs --
  const [urlState, setUrlState] = useUrlState({
    search: "",
    category: "all",
    manufacturer: "all",
    supplier: "all",
    pageSize: ROWS_PER_PAGE_OPTIONS[0],
    page: "1",
  });

  // Derived values from URL state
  const searchValue = urlState.search;
  const categoryFilter = urlState.category;
  const manufacturerFilter = urlState.manufacturer;
  const supplierFilter = urlState.supplier;
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
  const setRowsPerPage = useCallback(
    (n: number) => setUrlState({ pageSize: String(n), page: "1" }),
    [setUrlState],
  );
  const setPage = useCallback(
    (p: number) => setUrlState({ page: String(p) }),
    [setUrlState],
  );

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedConsumable, setSelectedConsumable] = useState(null);
  const [consumablesData, setConsumablesData] = useState(items);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  const categoryById = useMemo(
    () =>
      new Map(
        categories.map((c) => [
          c.consumablecategorytypeid,
          c.consumablecategorytypename,
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
    return consumablesData.filter((item) => {
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
        categoryFilter === "all" ||
        String(item.consumablecategorytypeid ?? "") === categoryFilter;
      const matchesManufacturer =
        manufacturerFilter === "all" ||
        String(item.manufacturerid ?? "") === manufacturerFilter;
      const matchesSupplier =
        supplierFilter === "all" ||
        String(item.supplierid ?? "") === supplierFilter;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesManufacturer &&
        matchesSupplier
      );
    });
  }, [
    consumablesData,
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

  const columns = [
    { key: "consumablename", label: "Name" },
    { key: "category", label: "Category" },
    { key: "quantity", label: "Qty" },
    { key: "stockStatus", label: "Stock" },
    { key: "manufacturer", label: "Manufacturer" },
    { key: "supplier", label: "Supplier" },
    { key: "purchaseprice", label: "Price" },
    { key: "purchasedate", label: "Purchased" },
    { key: "actions", label: "Actions", hideable: false },
  ];

  const handleDelete = async (consumableId: string) => {
    try {
      const response = await fetch("/api/consumable", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consumableid: consumableId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete consumable");
      }

      const result = await response.json();

      toast.success(result.message, {
        description: `${consumableId} deleted successfully`,
      });

      setConsumablesData((prevItems) =>
        prevItems.filter((item) => item.consumableid !== consumableId),
      );
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error("Error deleting consumable:", error);
      toast.error("Failed to delete consumable", {
        description: error.message,
      });
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedKeys);
      for (const id of ids) {
        await fetch("/api/consumable", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consumableid: id }),
        });
      }
      setConsumablesData((prev) =>
        prev.filter((item) => !selectedKeys.has(item.consumableid)),
      );
      toast.success(`Deleted ${ids.length} consumable(s)`);
      setSelectedKeys(new Set());
      setShowBulkDelete(false);
    } catch (error) {
      toast.error("Failed to delete some consumables");
    } finally {
      setBulkDeleting(false);
    }
  };

  const renderCell = (item, columnKey) => {
    switch (columnKey) {
      case "consumablename":
        return (
          <Link
            href={`/consumables/${item.consumableid}`}
            className="text-primary font-medium hover:underline"
          >
            {item.consumablename}
          </Link>
        );
      case "category":
        return categoryById.get(item.consumablecategorytypeid) ?? "-";
      case "quantity":
        return item.quantity ?? 0;
      case "stockStatus": {
        const qty = item.quantity ?? 0;
        const min = item.minQuantity ?? 0;
        if (min > 0 && qty <= 0) {
          return (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              Out of Stock
            </span>
          );
        }
        if (min > 0 && qty <= min) {
          return (
            <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
              Low Stock
            </span>
          );
        }
        if (min > 0) {
          return (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              In Stock
            </span>
          );
        }
        return <span className="text-muted-foreground text-xs">-</span>;
      }
      case "manufacturer":
        return manufacturerById.get(item.manufacturerid) ?? "-";
      case "supplier":
        return supplierById.get(item.supplierid) ?? "-";
      case "purchaseprice":
        return formatPrice(item.purchaseprice);
      case "purchasedate":
        return formatDate(item.purchasedate);
      case "actions":
        return (
          <div className="flex items-center gap-2">
            <Button
              className="text-muted-foreground h-6 w-6 cursor-pointer text-lg hover:opacity-80"
              size="icon"
              variant="ghost"
              asChild
            >
              <Link href={`/consumables/${item.consumableid}/edit`}>
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
                    setSelectedConsumable(item);
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
          <h1 className="text-2xl font-semibold">Consumables</h1>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              className="pl-9"
              placeholder="Search by name, category, manufacturer, or supplier"
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
                      key={String(category.consumablecategorytypeid)}
                      value={String(category.consumablecategorytypeid)}
                    >
                      {category.consumablecategorytypename}
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
            <Button asChild>
              <Link href="/consumables/create">
                <PlusIcon className="mr-2 h-4 w-4" />
                Create
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-muted-foreground text-sm">
            Showing {paginatedItems.length} of {filteredItems.length}{" "}
            consumables
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
        keyExtractor={(item) => item.consumableid}
        emptyMessage="No consumables found"
        mobileCardView={true}
        storageKey="columns:consumables"
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
            <DialogTitle>Delete Consumable</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete consumable &quot;
              {selectedConsumable?.consumablename}&quot;? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDelete(selectedConsumable?.consumableid)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showBulkDelete}
        onOpenChange={setShowBulkDelete}
        title={`Delete ${selectedKeys.size} consumable(s)?`}
        description="This will permanently delete the selected consumables. This cannot be undone."
        confirmLabel="Delete All"
        onConfirm={handleBulkDelete}
        loading={bulkDeleting}
      />
    </div>
  );
}
