"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SelectWithQuickCreate, {
  type QuickCreateOption,
} from "@/components/SelectWithQuickCreate";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import CustomFieldsSection from "@/components/CustomFieldsSection";

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
  const [categoryOptions, setCategoryOptions] = useState<QuickCreateOption[]>(
    () => categories.map((c) => ({ id: c.id, label: c.name })),
  );
  const [manufacturerOptions, setManufacturerOptions] = useState<
    QuickCreateOption[]
  >(() =>
    manufacturers.map((m) => ({
      id: m.manufacturerid,
      label: m.manufacturername,
    })),
  );
  const [supplierOptions, setSupplierOptions] = useState<QuickCreateOption[]>(
    () => suppliers.map((s) => ({ id: s.supplierid, label: s.suppliername })),
  );
  const [locationOptions, setLocationOptions] = useState<QuickCreateOption[]>(
    () =>
      locations.map((l) => ({
        id: l.locationid,
        label: l.locationname || "Unnamed",
      })),
  );
  const [customFieldValues, setCustomFieldValues] = useState<
    Record<string, string | null>
  >({});
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
        initialData.purchasePrice == null
          ? ""
          : String(initialData.purchasePrice),
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
        totalQuantity:
          form.totalQuantity === "" ? 0 : Number(form.totalQuantity),
        minQuantity: form.minQuantity === "" ? 0 : Number(form.minQuantity),
        purchasePrice:
          form.purchasePrice === "" ? null : Number(form.purchasePrice),
        purchaseDate: form.purchaseDate || null,
        manufacturerId: form.manufacturerId || null,
        supplierId: form.supplierId || null,
        locationId: form.locationId || null,
      };

      if (mode === "edit" && initialData?.updatedAt) {
        payload._expectedVersion = initialData.updatedAt;
      }

      const url =
        mode === "edit" && initialData?.id
          ? `/api/components/${initialData.id}`
          : "/api/components";

      const res = await fetch(url, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const err = await res.json().catch(() => ({}));
        toast.error(
          err.error ||
            "This item was modified by someone else. Please refresh and try again.",
        );
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to save component");
      }

      const created = await res.json();
      if (mode === "create" && Object.keys(customFieldValues).length > 0) {
        await fetch("/api/custom-fields/values", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityId: created.id,
            entityType: "component",
            values: customFieldValues,
          }),
        });
      }
      toast.success(
        mode === "edit" ? "Component updated" : "Component created",
        {
          description: created.name,
        },
      );
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
      <form onSubmit={onSubmit} className="flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl md:text-3xl">
              {mode === "edit" ? "Edit Component" : "Create Component"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Track hardware parts like RAM, SSDs, cables, and adapters.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Button asChild variant="ghost" className="w-full sm:w-auto">
              <Link href="/components">Cancel</Link>
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={submitting}
            >
              {mode === "edit" ? "Save" : "Create"}
            </Button>
          </div>
        </div>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <section className="rounded-lg border p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                Component Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                value={form.name}
                onChange={onChange}
                required
              />
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
              <SelectWithQuickCreate
                id="categoryId"
                value={form.categoryId}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, categoryId: value }))
                }
                options={categoryOptions}
                onItemCreated={(item) =>
                  setCategoryOptions((prev) => [...prev, item])
                }
                placeholder="Select a category"
                apiEndpoint="/api/componentCategory"
                nameField="name"
                idField="id"
                entityLabel="Category"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationId">Location</Label>
              <SelectWithQuickCreate
                id="locationId"
                value={form.locationId}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, locationId: value }))
                }
                options={locationOptions}
                onItemCreated={(item) =>
                  setLocationOptions((prev) => [...prev, item])
                }
                placeholder="Select a location"
                apiEndpoint="/api/location"
                nameField="locationname"
                idField="locationid"
                entityLabel="Location"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manufacturerId">Manufacturer</Label>
              <SelectWithQuickCreate
                id="manufacturerId"
                value={form.manufacturerId}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, manufacturerId: value }))
                }
                options={manufacturerOptions}
                onItemCreated={(item) =>
                  setManufacturerOptions((prev) => [...prev, item])
                }
                placeholder="Select a manufacturer"
                apiEndpoint="/api/manufacturer"
                nameField="manufacturername"
                idField="manufacturerid"
                entityLabel="Manufacturer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplierId">Supplier</Label>
              <SelectWithQuickCreate
                id="supplierId"
                value={form.supplierId}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, supplierId: value }))
                }
                options={supplierOptions}
                onItemCreated={(item) =>
                  setSupplierOptions((prev) => [...prev, item])
                }
                placeholder="Select a supplier"
                apiEndpoint="/api/supplier"
                nameField="suppliername"
                idField="supplierid"
                entityLabel="Supplier"
              />
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
              <Label htmlFor="minQuantity">
                Min. Quantity (Alert Threshold)
              </Label>
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

        <CustomFieldsSection
          entityType="component"
          entityId={mode === "edit" ? initialData?.id : null}
          onChange={setCustomFieldValues}
        />

        <Separator />

        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <Button asChild variant="ghost" className="w-full sm:w-auto">
            <Link href="/components">Cancel</Link>
          </Button>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={submitting}
          >
            {mode === "edit" ? "Save Changes" : "Create Component"}
          </Button>
        </div>
      </form>
    </div>
  );
}
