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

export default function ConsumableCreateForm({
  categories,
  manufacturers,
  suppliers,
  initialData = null,
  mode = "create",
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => {
    if (!initialData) {
      return {
        consumablename: "",
        consumablecategorytypeid: "",
        manufacturerid: "",
        supplierid: "",
        purchaseprice: "",
        purchasedate: "",
      };
    }

    return {
      consumablename: initialData.consumablename ?? "",
      consumablecategorytypeid: initialData.consumablecategorytypeid ?? "",
      manufacturerid: initialData.manufacturerid ?? "",
      supplierid: initialData.supplierid ?? "",
      purchaseprice:
        initialData.purchaseprice === null || initialData.purchaseprice === undefined
          ? ""
          : String(initialData.purchaseprice),
      purchasedate: initialData.purchasedate ? initialData.purchasedate.slice(0, 10) : "",
    };
  });

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const payload: Record<string, unknown> = {
        ...form,
        purchaseprice: form.purchaseprice === "" ? null : form.purchaseprice,
        purchasedate: form.purchasedate || null,
      };

      if (mode === "edit" && initialData?.consumableid) {
        payload.consumableid = initialData.consumableid;
      }

      const res = await fetch("/api/consumable", {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create consumable");
      }

      const created = await res.json();
      toast.success(mode === "edit" ? "Consumable updated" : "Consumable created", {
        description: created.consumablename,
      });
      router.push("/consumables");
    } catch (err) {
      setError(err.message);
      toast.error("Create failed", { description: err.message });
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
              {mode === "edit" ? "Edit Consumable" : "Create Consumable"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Track recurring purchases with clear sourcing details.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button asChild variant="ghost" className="w-full sm:w-auto">
              <Link href="/consumables">Cancel</Link>
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
              <Label htmlFor="consumablename">
                Consumable Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="consumablename"
                name="consumablename"
                value={form.consumablename}
                onChange={onChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consumablecategorytypeid">
                Category <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.consumablecategorytypeid}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, consumablecategorytypeid: value }))
                }
                required
              >
                <SelectTrigger id="consumablecategorytypeid">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.consumablecategorytypeid} value={category.consumablecategorytypeid}>
                      {category.consumablecategorytypename}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manufacturerid">
                Manufacturer <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.manufacturerid}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, manufacturerid: value }))
                }
                required
              >
                <SelectTrigger id="manufacturerid">
                  <SelectValue placeholder="Select a manufacturer" />
                </SelectTrigger>
                <SelectContent>
                  {manufacturers.map((manufacturer) => (
                    <SelectItem key={manufacturer.manufacturerid} value={manufacturer.manufacturerid}>
                      {manufacturer.manufacturername}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplierid">
                Supplier <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.supplierid}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, supplierid: value }))
                }
                required
              >
                <SelectTrigger id="supplierid">
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.supplierid} value={supplier.supplierid}>
                      {supplier.suppliername}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchaseprice">Purchase Price</Label>
              <Input
                id="purchaseprice"
                name="purchaseprice"
                type="number"
                min={0}
                step="0.01"
                value={form.purchaseprice}
                onChange={onChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchasedate">Purchase Date</Label>
              <Input
                id="purchasedate"
                name="purchasedate"
                type="date"
                value={form.purchasedate}
                onChange={onChange}
              />
            </div>
          </div>
        </section>

        <Separator />

        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <Button asChild variant="ghost" className="w-full sm:w-auto">
            <Link href="/consumables">Cancel</Link>
          </Button>
          <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
            {mode === "edit" ? "Save Changes" : "Create Consumable"}
          </Button>
        </div>
      </form>
    </div>
  );
}
