"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const statusSort = (a, b) => a.statustypename.localeCompare(b.statustypename);

export default function AccessoryCreateForm({
  categories,
  locations,
  manufacturers,
  models,
  statuses,
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
        accessoriename: "",
        accessorietag: "",
        accessoriecategorytypeid: "",
        statustypeid: "",
        manufacturerid: "",
        modelid: "",
        supplierid: "",
        locationid: "",
        purchaseprice: "",
        purchasedate: "",
        requestable: true,
      };
    }

    return {
      accessoriename: initialData.accessoriename ?? "",
      accessorietag: initialData.accessorietag ?? "",
      accessoriecategorytypeid: initialData.accessoriecategorytypeid ?? "",
      statustypeid: initialData.statustypeid ?? "",
      manufacturerid: initialData.manufacturerid ?? "",
      modelid: initialData.modelid ?? "",
      supplierid: initialData.supplierid ?? "",
      locationid: initialData.locationid ?? "",
      purchaseprice:
        initialData.purchaseprice === null || initialData.purchaseprice === undefined
          ? ""
          : String(initialData.purchaseprice),
      purchasedate: initialData.purchasedate ? initialData.purchasedate.slice(0, 10) : "",
      requestable: Boolean(initialData.requestable ?? true),
    };
  });

  const sortedStatuses = useMemo(() => [...statuses].sort(statusSort), [statuses]);

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
        requestable: Boolean(form.requestable),
      };

      if (mode === "edit" && initialData?.accessorieid) {
        payload.accessorieid = initialData.accessorieid;
      }

      const res = await fetch("/api/accessories", {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create accessory");
      }

      const created = await res.json();
      toast.success(
        mode === "edit" ? "Accessory updated" : "Accessory created",
        { description: created.accessorietag }
      );
      router.push(mode === "edit" && initialData?.accessorieid ? `/accessories` : "/accessories");
    } catch (err) {
      setError(err.message);
      toast.error("Create failed", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <Toaster position="bottom-right" />
      <form onSubmit={onSubmit} className="flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold">
              {mode === "edit" ? "Edit Accessory" : "Create Accessory"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Provide identification, ownership, and lifecycle details.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button asChild variant="ghost" className="w-full sm:w-auto">
              <Link href="/accessories">Cancel</Link>
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
              {mode === "edit" ? "Save" : "Create"}
            </Button>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="rounded-lg border p-4">
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">Basics</h2>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accessoriename">
                  Accessory Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="accessoriename"
                  name="accessoriename"
                  value={form.accessoriename}
                  onChange={onChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accessorietag">
                  Asset Tag <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="accessorietag"
                  name="accessorietag"
                  value={form.accessorietag}
                  onChange={onChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accessoriecategorytypeid">
                  Category <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.accessoriecategorytypeid}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, accessoriecategorytypeid: value }))
                  }
                  required
                >
                  <SelectTrigger id="accessoriecategorytypeid">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.accessoriecategorytypeid} value={category.accessoriecategorytypeid}>
                        {category.accessoriecategorytypename}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="statustypeid">
                  Status <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.statustypeid}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, statustypeid: value }))
                  }
                  required
                >
                  <SelectTrigger id="statustypeid">
                    <SelectValue placeholder="Select a status" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedStatuses.map((status) => (
                      <SelectItem key={status.statustypeid} value={status.statustypeid}>
                        {status.statustypename}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationid">
                  Location <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.locationid}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, locationid: value }))
                  }
                  required
                >
                  <SelectTrigger id="locationid">
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.locationid} value={location.locationid}>
                        {location.locationname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requestable"
                  checked={form.requestable}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, requestable: Boolean(checked) }))
                  }
                />
                <Label htmlFor="requestable" className="cursor-pointer">Requestable</Label>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">Procurement & Specs</h2>
            <div className="grid grid-cols-1 gap-4">
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
                <Label htmlFor="modelid">
                  Model <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.modelid}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, modelid: value }))
                  }
                  required
                >
                  <SelectTrigger id="modelid">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.modelid} value={model.modelid}>
                        {model.modelname}
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
                  value={form.purchaseprice}
                  onChange={onChange}
                  min={0}
                  step="0.01"
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
          </div>
        </section>

        <Separator />

        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <Button asChild variant="ghost" className="w-full sm:w-auto">
            <Link href="/accessories">Cancel</Link>
          </Button>
          <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
            {mode === "edit" ? "Save Changes" : "Create Accessory"}
          </Button>
        </div>
      </form>
    </div>
  );
}
