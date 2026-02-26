"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

export default function ComponentCreateForm({
  categories,
  manufacturers,
  suppliers,
  locations,
  initialData = null,
  mode = "create",
}: {
  categories: { id: string; name: string }[];
  manufacturers: { manufacturerid: string; manufacturername: string }[];
  suppliers: { supplierid: string; suppliername: string }[];
  locations: { locationid: string; locationname: string | null }[];
  initialData?: any;
  mode?: "create" | "edit";
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => {
    if (!initialData) {
      return {
        name: "",
        serialNumber: "",
        categoryId: "",
        totalQuantity: "0",
        minQuantity: "0",
        purchasePrice: "",
        purchaseDate: "",
        manufacturerId: "",
        supplierId: "",
        locationId: "",
      };
    }
    return {
      name: initialData.name ?? "",
      serialNumber: initialData.serialNumber ?? "",
      categoryId: initialData.categoryId ?? "",
      totalQuantity: String(initialData.totalQuantity ?? 0),
      minQuantity: String(initialData.minQuantity ?? 0),
      purchasePrice:
        initialData.purchasePrice == null ? "" : String(initialData.purchasePrice),
      purchaseDate: initialData.purchaseDate
        ? initialData.purchaseDate.slice(0, 10)
        : "",
      manufacturerId: initialData.manufacturerId ?? "",
      supplierId: initialData.supplierId ?? "",
      locationId: initialData.locationId ?? "",
    };
  });

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        serialNumber: form.serialNumber || null,
        categoryId: form.categoryId,
        totalQuantity: form.totalQuantity === "" ? 0 : Number(form.totalQuantity),
        minQuantity: form.minQuantity === "" ? 0 : Number(form.minQuantity),
        purchasePrice: form.purchasePrice === "" ? null : Number(form.purchasePrice),
        purchaseDate: form.purchaseDate || null,
        manufacturerId: form.manufacturerId || null,
        supplierId: form.supplierId || null,
        locationId: form.locationId || null,
      };

      const url =
        mode === "edit" && initialData?.id
          ? `/api/components/${initialData.id}`
          : "/api/components";

      const res = await fetch(url, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to save component");
      }

      const created = await res.json();
      toast.success(mode === "edit" ? "Component updated" : "Component created", {
        description: created.name,
      });
      router.push("/components");
    } catch (err: any) {
      setError(err.message);
      toast.error("Save failed", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <Toaster position="bottom-right" />
      <form onSubmit={onSubmit} className="flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold">
              {mode === "edit" ? "Edit Component" : "Create Component"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track hardware parts like RAM, SSDs, cables, and adapters.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button asChild variant="ghost" className="w-full sm:w-auto">
              <Link href="/components">Cancel</Link>
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
              {mode === "edit" ? "Save" : "Create"}
            </Button>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <section className="rounded-lg border p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Component Name <span className="text-destructive">*</span>
              </Label>
              <Input id="name" name="name" value={form.name} onChange={onChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serialNumber">Serial Number</Label>
              <Input
                id="serialNumber"
                name="serialNumber"
                value={form.serialNumber}
                onChange={onChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryId">
                Category <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.categoryId}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, categoryId: value }))
                }
                required
              >
                <SelectTrigger id="categoryId">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationId">Location</Label>
              <Select
                value={form.locationId}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, locationId: value }))
                }
              >
                <SelectTrigger id="locationId">
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.locationid} value={loc.locationid}>
                      {loc.locationname || "Unnamed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manufacturerId">Manufacturer</Label>
              <Select
                value={form.manufacturerId}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, manufacturerId: value }))
                }
              >
                <SelectTrigger id="manufacturerId">
                  <SelectValue placeholder="Select a manufacturer" />
                </SelectTrigger>
                <SelectContent>
                  {manufacturers.map((m) => (
                    <SelectItem key={m.manufacturerid} value={m.manufacturerid}>
                      {m.manufacturername}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplierId">Supplier</Label>
              <Select
                value={form.supplierId}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, supplierId: value }))
                }
              >
                <SelectTrigger id="supplierId">
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.supplierid} value={s.supplierid}>
                      {s.suppliername}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalQuantity">Total Quantity</Label>
              <Input
                id="totalQuantity"
                name="totalQuantity"
                type="number"
                min={0}
                value={form.totalQuantity}
                onChange={onChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minQuantity">Min. Quantity (Alert Threshold)</Label>
              <Input
                id="minQuantity"
                name="minQuantity"
                type="number"
                min={0}
                value={form.minQuantity}
                onChange={onChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchasePrice">Purchase Price</Label>
              <Input
                id="purchasePrice"
                name="purchasePrice"
                type="number"
                min={0}
                step="0.01"
                value={form.purchasePrice}
                onChange={onChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchaseDate">Purchase Date</Label>
              <Input
                id="purchaseDate"
                name="purchaseDate"
                type="date"
                value={form.purchaseDate}
                onChange={onChange}
              />
            </div>
          </div>
        </section>

        <Separator />

        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <Button asChild variant="ghost" className="w-full sm:w-auto">
            <Link href="/components">Cancel</Link>
          </Button>
          <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
            {mode === "edit" ? "Save Changes" : "Create Component"}
          </Button>
        </div>
      </form>
    </div>
  );
}
