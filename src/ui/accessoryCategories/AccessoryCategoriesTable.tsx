"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { PlusIcon, SearchIcon } from "../Icons";

const ROWS_PER_PAGE_OPTIONS = ["10", "20", "50", "100"];

export default function AccessoryCategoriesTable({ items }) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [rowsPerPage, _setRowsPerPage] = useState(
    Number(ROWS_PER_PAGE_OPTIONS[0]),
  );
  const [page, setPage] = useState(1);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchValue.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !normalizedQuery ||
        (item.accessoriecategorytypename ?? "")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesSearch;
    });
  }, [items, searchValue]);

  const pages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredItems.slice(start, start + rowsPerPage);
  }, [filteredItems, page, rowsPerPage]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      const res = await fetch("/api/accessoryCategory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessoriecategorytypeid: id }),
      });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Deleted successfully");
      router.refresh();
    } catch (err) {
      console.error("Failed to delete accessory category", err);
      toast.error("Failed to delete");
    }
  };

  const columns = [
    { key: "accessoriecategorytypename", label: "Category Name" },
    { key: "actions", label: "" },
  ];

  const renderCell = (item, columnKey) => {
    switch (columnKey) {
      case "accessoriecategorytypename":
        return item.accessoriecategorytypename;
      case "actions":
        return (
          <div className="flex justify-end gap-1">
            <Link
              href={`/accessoryCategories/${item.accessoriecategorytypeid}/edit`}
            >
              <Button variant="ghost" size="sm">
                <Edit className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(item.accessoriecategorytypeid)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
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
          <h1 className="text-2xl font-semibold">Accessory Categories</h1>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              className="pl-9"
              placeholder="Search accessory categories"
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/accessoryCategories/create">
                <PlusIcon className="mr-2 h-4 w-4" />
                Create
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-muted-foreground text-sm">
            Showing {paginatedItems.length} of {filteredItems.length} accessory
            categories
          </span>
        </div>
      </div>
      <ResponsiveTable
        columns={columns}
        data={paginatedItems}
        renderCell={renderCell}
        keyExtractor={(item) => item.accessoriecategorytypeid}
        emptyMessage="No accessory categories found"
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
    </div>
  );
}
