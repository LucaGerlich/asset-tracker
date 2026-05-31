"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import SelectWithQuickCreate, {
  type QuickCreateOption,
} from "@/components/SelectWithQuickCreate";
import CustomFieldsSection from "@/components/CustomFieldsSection";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";

export default function ConsumableCreateForm({
  categories: initialCategories,
  manufacturers: initialManufacturers,
  suppliers: initialSuppliers,
  initialData = null,
  mode = "create",
}) {
  const [categoryOptions, setCategoryOptions] = useState<QuickCreateOption[]>(
    () =>
      initialCategories.map((c: any) => ({
        id: c.consumablecategorytypeid,
        label: c.consumablecategorytypename,
      })),
  );
  const [manufacturerOptions, setManufacturerOptions] = useState<
    QuickCreateOption[]
  >(() =>
    initialManufacturers.map((m: any) => ({
      id: m.manufacturerid,
      label: m.manufacturername,
    })),
  );
  const [supplierOptions, setSupplierOptions] = useState<QuickCreateOption[]>(
    () =>
      initialSuppliers.map((s: any) => ({
        id: s.supplierid,
        label: s.suppliername,
      })),
  );
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [customFieldValues, setCustomFieldValues] = useState<
    Record<string, string | null>
  >({});
  const [form, setForm] = useState(() => {
    if (!initialData) {
      return {
        consumablename: "",
        consumablecategorytypeid: "",
        manufacturerid: "",
        supplierid: "",
        purchaseprice: "",
        purchasedate: "",
        quantity: "0",
        minQuantity: "0",
      };
    }

    return {
      consumablename: initialData.consumablename ?? "",
      consumablecategorytypeid: initialData.consumablecategorytypeid ?? "",
      manufacturerid: initialData.manufacturerid ?? "",
      supplierid: initialData.supplierid ?? "",
      purchaseprice:
        initialData.purchaseprice === null ||
        initialData.purchaseprice === undefined
          ? ""
          : String(initialData.purchaseprice),
      purchasedate: initialData.purchasedate
        ? initialData.purchasedate.slice(0, 10)
        : "",
      quantity: String(initialData.quantity ?? 0),
      minQuantity: String(initialData.minQuantity ?? 0),
    };
  });

  const isDirty = mode === "create" ? form.consumablename !== "" : true;
  useUnsavedChanges(isDirty);

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
        quantity: form.quantity === "" ? 0 : Number(form.quantity),
        minQuantity: form.minQuantity === "" ? 0 : Number(form.minQuantity),
      };

      if (mode === "edit" && initialData?.consumableid) {
        payload.consumableid = initialData.consumableid;
        payload._expectedVersion = initialData.change_date ?? null;
      }

      const res = await fetch("/api/consumable", {
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
        throw new Error(err?.error || "Failed to create consumable");
      }

      const created = await res.json();
      if (mode === "create" && Object.keys(customFieldValues).length > 0) {
        await fetch("/api/custom-fields/values", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityId: created.consumableid,
            entityType: "consumable",
            values: customFieldValues,
          }),
        });
      }
      toast.success(
        mode === "edit" ? "Consumable updated" : "Consumable created",
        {
          description: created.consumablename,
        },
      );
      router.push("/consumables");
      router.refresh();
    } catch (err) {
      setError(err.message);
      toast.error("Create failed", { description: err.message });
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
              {mode === "edit" ? "Edit Consumable" : "Create Consumable"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Track recurring purchases with clear sourcing details.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Button asChild variant="ghost" className="w-full sm:w-auto">
              <Link href="/consumables">Cancel</Link>
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
              <SelectWithQuickCreate
                id="consumablecategorytypeid"
                value={form.consumablecategorytypeid}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    consumablecategorytypeid: value,
                  }))
                }
                options={categoryOptions}
                onItemCreated={(item) =>
                  setCategoryOptions((prev) => [...prev, item])
                }
                placeholder="Select a category"
                apiEndpoint="/api/consumableCategory"
                nameField="consumablecategorytypename"
                idField="consumablecategorytypeid"
                entityLabel="Category"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manufacturerid">
                Manufacturer <span className="text-destructive">*</span>
              </Label>
              <SelectWithQuickCreate
                id="manufacturerid"
                value={form.manufacturerid}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, manufacturerid: value }))
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
              <Label htmlFor="supplierid">
                Supplier <span className="text-destructive">*</span>
              </Label>
              <SelectWithQuickCreate
                id="supplierid"
                value={form.supplierid}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, supplierid: value }))
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
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                min={0}
                value={form.quantity}
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
              {Number(form.quantity) > 0 &&
                Number(form.minQuantity) > 0 &&
                Number(form.quantity) <= Number(form.minQuantity) && (
                  <p className="text-sm text-amber-600">
                    Stock is at or below minimum threshold.
                  </p>
                )}
            </div>
          </div>
        </section>

        <CustomFieldsSection
          entityType="consumable"
          entityId={mode === "edit" ? initialData?.consumableid : null}
          onChange={setCustomFieldValues}
        />

        <Separator />

        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <Button asChild variant="ghost" className="w-full sm:w-auto">
            <Link href="/consumables">Cancel</Link>
          </Button>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={submitting}
          >
            {mode === "edit" ? "Save Changes" : "Create Consumable"}
          </Button>
        </div>
      </form>
    </div>
  );
}
