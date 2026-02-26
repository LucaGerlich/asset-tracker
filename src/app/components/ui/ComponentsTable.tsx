"use client";

import React, { useState, useMemo } from "react";
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
import { Toaster, toast } from "sonner";

interface ComponentItem {
  id: string;
  name: string;
  serialNumber: string | null;
  totalQuantity: number;
  remainingQuantity: number;
  minQuantity: number;
  purchasePrice: number | null;
  category: { id: string; name: string } | null;
  manufacturer: { manufacturerid: string; manufacturername: string } | null;
  supplier: { supplierid: string; suppliername: string } | null;
  location: { locationid: string; locationname: string | null } | null;
}

export default function ComponentsTable({
  items,
  categories,
  manufacturers,
  suppliers,
}: {
  items: ComponentItem[];
  categories: { id: string; name: string }[];
  manufacturers: { manufacturerid: string; manufacturername: string }[];
  suppliers: { supplierid: string; suppliername: string }[];
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        !search ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.serialNumber?.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchesCategory =
        categoryFilter === "all" || item.category?.id === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [items, search, categoryFilter]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete component "${name}"?`)) return;
    try {
      const res = await fetch(`/api/components/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Component deleted", { description: name });
      window.location.reload();
    } catch {
      toast.error("Failed to delete component");
    }
  };

  return (
    <div>
      <Toaster position="bottom-right" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Components</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track hardware parts like RAM, SSDs, and cables
          </p>
        </div>
        <Button asChild>
          <Link href="/components/create">Create Component</Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input
          placeholder="Search by name or serial..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="sm:max-w-[200px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No components found.</p>
          <Button asChild variant="link" className="mt-2">
            <Link href="/components/create">Create your first component</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="py-3 px-4 font-medium">Name</th>
                <th className="py-3 px-4 font-medium">Category</th>
                <th className="py-3 px-4 font-medium">Remaining</th>
                <th className="py-3 px-4 font-medium">Total</th>
                <th className="py-3 px-4 font-medium">Min Qty</th>
                <th className="py-3 px-4 font-medium">Location</th>
                <th className="py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const isLow =
                  item.minQuantity > 0 &&
                  item.remainingQuantity <= item.minQuantity;
                return (
                  <tr key={item.id} className="border-t">
                    <td className="py-3 px-4">
                      <Link
                        href={`/components/${item.id}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {item.name}
                      </Link>
                      {item.serialNumber && (
                        <span className="block text-xs text-muted-foreground">
                          S/N: {item.serialNumber}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">{item.category?.name ?? "-"}</td>
                    <td className="py-3 px-4">
                      <span
                        className={
                          isLow
                            ? "text-red-600 font-semibold"
                            : "font-medium"
                        }
                      >
                        {item.remainingQuantity}
                      </span>
                    </td>
                    <td className="py-3 px-4">{item.totalQuantity}</td>
                    <td className="py-3 px-4">{item.minQuantity}</td>
                    <td className="py-3 px-4">
                      {item.location?.locationname ?? "-"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/components/${item.id}/edit`}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          className="text-xs text-destructive hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
