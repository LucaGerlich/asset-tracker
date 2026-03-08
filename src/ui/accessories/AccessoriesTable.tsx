"use client";

import React, { useMemo, useState, useCallback } from "react";
import { useUrlState } from "@/hooks/useUrlState";
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
  // -- URL-synced state for shareable filter / pagination URLs --
  const [urlState, setUrlState] = useUrlState({
    search: "",
    status: "all",
    category: "all",
    location: "all",
    requestable: "all",
    pageSize: ROWS_PER_PAGE_OPTIONS[0],
    page: "1",
  });

  // Derived values from URL state
  const searchValue = urlState.search;
  const statusFilter = urlState.status;
  const categoryFilter = urlState.category;
  const locationFilter = urlState.location;
  const requestableFilter = urlState.requestable;
  const rowsPerPage =
    Number(urlState.pageSize) || Number(ROWS_PER_PAGE_OPTIONS[0]);
  const page = Number(urlState.page) || 1;

  // Convenience setters that update URL state
  const setSearchValue = useCallback(
    (v: string) => setUrlState({ search: v, page: "1" }),
    [setUrlState],
  );
  const setStatusFilter = useCallback(
    (v: string) => setUrlState({ status: v, page: "1" }),
    [setUrlState],
  );
  const setCategoryFilter = useCallback(
    (v: string) => setUrlState({ category: v, page: "1" }),
    [setUrlState],
  );
  const setLocationFilter = useCallback(
    (v: string) => setUrlState({ location: v, page: "1" }),
    [setUrlState],
  );
  const setRequestableFilter = useCallback(
    (v: string) => setUrlState({ requestable: v, page: "1" }),
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
  const [selectedAccessory, setSelectedAccessory] = useState(null);
  const [accessoriesData, setAccessoriesData] = useState(items);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  const manufacturerById = useMemo(
    () =>
      new Map(manufacturers.map((m) => [m.manufacturerid, m.manufacturername])),
    [manufacturers],
  );
  const modelById = useMemo(
    () => new Map(models.map((m) => [m.modelid, m.modelname])),
    [models],
  );
  const statusById = useMemo(
    () => new Map(statuses.map((s) => [s.statustypeid, s.statustypename])),
    [statuses],
  );
  const categoryById = useMemo(
    () =>
      new Map(
        categories.map((c) => [
          c.accessoriecategorytypeid,
          c.accessoriecategorytypename,
        ]),
      ),
    [categories],
  );
  const locationById = useMemo(
    () => new Map(locations.map((l) => [l.locationid, l.locationname])),
    [locations],
  );
  const supplierById = useMemo(
    () => new Map(suppliers.map((s) => [s.supplierid, s.suppliername])),
    [suppliers],
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchValue.trim().toLowerCase();
    return accessoriesData.filter((item) => {
      const matchesSearch =
        !normalizedQuery ||
        [
          item.accessoriename,
          item.accessorietag,
          manufacturerById.get(item.manufacturerid),
          modelById.get(item.modelid),
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedQuery));

      const matchesStatus =
        statusFilter === "all" ||
        String(item.statustypeid ?? "") === statusFilter;

      const matchesCategory =
        categoryFilter === "all" ||
        String(item.accessoriecategorytypeid ?? "") === categoryFilter;

      const matchesLocation =
        locationFilter === "all" ||
        String(item.locationid ?? "") === locationFilter;

      const matchesRequestable =
        requestableFilter === "all" ||
        (requestableFilter === "yes" && item.requestable) ||
        (requestableFilter === "no" && !item.requestable);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory &&
        matchesLocation &&
        matchesRequestable
      );
    });
  }, [
    accessoriesData,
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

  const handleDelete = async (accessoryId) => {
    try {
      const response = await fetch("/api/accessories/deleteAccessory/", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accessoryId }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete accessory");
      }

      const result = await response.json();

      toast.success(result.message, {
        description: `${accessoryId} deleted successfully`,
      });

      setAccessoriesData((prevItems) =>
        prevItems.filter((item) => item.accessorieid !== accessoryId),
      );
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error("Error deleting accessory:", error);
      toast.error("Failed to delete accessory");
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedKeys);
      for (const id of ids) {
        await fetch("/api/accessories/deleteAccessory/", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessoryId: id }),
        });
      }
      setAccessoriesData((prev) =>
        prev.filter((item) => !selectedKeys.has(item.accessorieid)),
      );
      toast.success(`Deleted ${ids.length} accessory(ies)`);
      setSelectedKeys(new Set());
      setShowBulkDelete(false);
    } catch (error) {
      toast.error("Failed to delete some accessories");
    } finally {
      setBulkDeleting(false);
    }
  };

  const columns = [
    { key: "accessoriename", label: "Name" },
    { key: "accessorietag", label: "Tag" },
    { key: "manufacturer", label: "Manufacturer" },
    { key: "model", label: "Model" },
    { key: "status", label: "Status" },
    { key: "category", label: "Category" },
    { key: "location", label: "Location" },
    { key: "supplier", label: "Supplier" },
    { key: "requestable", label: "Requestable" },
    { key: "actions", label: "Actions", hideable: false },
  ];

  const renderCell = (item: Record<string, unknown>, columnKey: string) => {
    switch (columnKey) {
      case "accessoriename":
        return String(item.accessoriename ?? "-");
      case "accessorietag":
        return String(item.accessorietag ?? "-");
      case "manufacturer":
        return String(
          manufacturerById.get(item.manufacturerid as number) ?? "-",
        );
      case "model":
        return String(modelById.get(item.modelid as number) ?? "-");
      case "status":
        const statusName = statusById.get(item.statustypeid as number);
        return statusName ? <Badge>{String(statusName)}</Badge> : "-";
      case "category":
        return String(
          categoryById.get(item.accessoriecategorytypeid as number) ?? "-",
        );
      case "location":
        return String(locationById.get(item.locationid as number) ?? "-");
      case "supplier":
        return String(supplierById.get(item.supplierid as number) ?? "-");
      case "requestable":
        return (
          <Badge variant={item.requestable ? "default" : "secondary"}>
            {item.requestable ? "Yes" : "No"}
          </Badge>
        );
      case "actions":
        return (
          <div className="flex items-center gap-2">
            <Button
              className="text-muted-foreground h-6 w-6 cursor-pointer text-lg hover:opacity-80"
              size="icon"
              variant="ghost"
              asChild
            >
              <Link href={`/accessories/${item.accessorieid}/edit`}>
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
                    setSelectedAccessory(item);
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
          <h1 className="text-2xl font-semibold">Accessories</h1>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              className="pl-9"
              placeholder="Search by name, tag, manufacturer, or model"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-medium">
                Status
              </span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem
                      key={String(status.statustypeid)}
                      value={String(status.statustypeid)}
                    >
                      {status.statustypename}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-medium">
                Category
              </span>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem
                      key={String(category.accessoriecategorytypeid)}
                      value={String(category.accessoriecategorytypeid)}
                    >
                      {category.accessoriecategorytypename}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-medium">
                Location
              </span>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((location) => (
                    <SelectItem
                      key={String(location.locationid)}
                      value={String(location.locationid)}
                    >
                      {location.locationname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-medium">
                Requestable
              </span>
              <Select
                value={requestableFilter}
                onValueChange={setRequestableFilter}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  {requestableOptions.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button asChild>
              <Link href="/accessories/create">
                <PlusIcon className="mr-2 h-4 w-4" />
                Create
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-muted-foreground text-sm">
            Showing {paginatedItems.length} of {filteredItems.length}{" "}
            accessories
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
        keyExtractor={(item) =>
          (item as Record<string, unknown>).accessorieid as number
        }
        emptyMessage="No accessories found"
        mobileCardView={true}
        storageKey="columns:accessories"
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
            <DialogTitle>
              Delete {selectedAccessory?.accessoriename || "this item"}?
            </DialogTitle>
          </DialogHeader>
          <DialogDescription>
            <p className="text-muted-foreground text-sm">
              This action permanently removes the accessory and its user
              assignment. This cannot be undone.
            </p>
          </DialogDescription>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                selectedAccessory &&
                handleDelete(selectedAccessory.accessorieid)
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={showBulkDelete}
        onOpenChange={setShowBulkDelete}
        title={`Delete ${selectedKeys.size} accessory(ies)?`}
        description="This will permanently delete the selected accessories. This cannot be undone."
        confirmLabel="Delete All"
        onConfirm={handleBulkDelete}
        loading={bulkDeleting}
      />
    </div>
  );
}
