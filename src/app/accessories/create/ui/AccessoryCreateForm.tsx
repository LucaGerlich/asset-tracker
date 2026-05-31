"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

export default function AccessoryCreateForm({
  categories: initialCategories,
  locations: initialLocations,
  manufacturers: initialManufacturers,
  models: initialModels,
  statuses: initialStatuses,
  suppliers: initialSuppliers,
  initialData = null,
  mode = "create",
}) {
  const [categoryOptions, setCategoryOptions] = useState<QuickCreateOption[]>(
    () =>
      initialCategories.map((c: any) => ({
        id: c.accessoriecategorytypeid,
        label: c.accessoriecategorytypename,
      })),
  );
  const [locationOptions, setLocationOptions] = useState<QuickCreateOption[]>(
    () =>
      initialLocations.map((l: any) => ({
        id: l.locationid,
        label: l.locationname,
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
  const [modelOptions, setModelOptions] = useState<QuickCreateOption[]>(() =>
    initialModels.map((m: any) => ({ id: m.modelid, label: m.modelname })),
  );
  const [statusOptions, setStatusOptions] = useState<QuickCreateOption[]>(() =>
    initialStatuses.map((s: any) => ({
      id: s.statustypeid,
      label: s.statustypename,
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
        initialData.purchaseprice === null ||
        initialData.purchaseprice === undefined
          ? ""
          : String(initialData.purchaseprice),
      purchasedate: initialData.purchasedate
        ? initialData.purchasedate.slice(0, 10)
        : "",
      requestable: Boolean(initialData.requestable ?? true),
    };
  });

  const sortedStatusOptions = useMemo(
    () => [...statusOptions].sort((a, b) => a.label.localeCompare(b.label)),
    [statusOptions],
  );

  const isDirty =
    mode === "create"
      ? form.accessoriename !== "" || form.accessorietag !== ""
      : JSON.stringify(form) !== JSON.stringify(initialData);
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
        requestable: Boolean(form.requestable),
      };

      if (mode === "edit" && initialData?.accessorieid) {
        payload.accessorieid = initialData.accessorieid;
        payload._expectedVersion = initialData.change_date ?? null;
      }

      const res = await fetch("/api/accessories", {
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
        throw new Error(err?.error || "Failed to create accessory");
      }

      const created = await res.json();
      if (mode === "create" && Object.keys(customFieldValues).length > 0) {
        await fetch("/api/custom-fields/values", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityId: created.accessorieid,
            entityType: "accessory",
            values: customFieldValues,
          }),
        });
      }
      toast.success(
        mode === "edit" ? "Accessory updated" : "Accessory created",
        { description: created.accessorietag },
      );
      router.push(
        mode === "edit" && initialData?.accessorieid
          ? `/accessories`
          : "/accessories",
      );
      router.refresh();
    } catch (err) {
      setError(err.message);
      toast.error("Create failed", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <form onSubmit={onSubmit} className="flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl md:text-3xl">
              {mode === "edit" ? "Edit Accessory" : "Create Accessory"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Provide identification, ownership, and lifecycle details.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Button asChild variant="ghost" className="w-full sm:w-auto">
              <Link href="/accessories">Cancel</Link>
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

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
          <div className="rounded-lg border p-4">
            <h2 className="text-muted-foreground mb-3 text-sm font-semibold">
              Basics
            </h2>
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
                <SelectWithQuickCreate
                  id="accessoriecategorytypeid"
                  value={form.accessoriecategorytypeid}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      accessoriecategorytypeid: value,
                    }))
                  }
                  options={categoryOptions}
                  onItemCreated={(item) =>
                    setCategoryOptions((prev) => [...prev, item])
                  }
                  placeholder="Select a category"
                  apiEndpoint="/api/accessoryCategory"
                  nameField="accessoriecategorytypename"
                  idField="accessoriecategorytypeid"
                  entityLabel="Category"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="statustypeid">
                  Status <span className="text-destructive">*</span>
                </Label>
                <SelectWithQuickCreate
                  id="statustypeid"
                  value={form.statustypeid}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, statustypeid: value }))
                  }
                  options={sortedStatusOptions}
                  onItemCreated={(item) =>
                    setStatusOptions((prev) => [...prev, item])
                  }
                  placeholder="Select a status"
                  apiEndpoint="/api/statusType"
                  nameField="statustypename"
                  idField="statustypeid"
                  entityLabel="Status"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="locationid">
                  Location <span className="text-destructive">*</span>
                </Label>
                <SelectWithQuickCreate
                  id="locationid"
                  value={form.locationid}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, locationid: value }))
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
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requestable"
                  checked={form.requestable}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      requestable: Boolean(checked),
                    }))
                  }
                />
                <Label htmlFor="requestable" className="cursor-pointer">
                  Requestable
                </Label>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <h2 className="text-muted-foreground mb-3 text-sm font-semibold">
              Procurement & Specs
            </h2>
            <div className="grid grid-cols-1 gap-4">
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
                <Label htmlFor="modelid">
                  Model <span className="text-destructive">*</span>
                </Label>
                <SelectWithQuickCreate
                  id="modelid"
                  value={form.modelid}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, modelid: value }))
                  }
                  options={modelOptions}
                  onItemCreated={(item) =>
                    setModelOptions((prev) => [...prev, item])
                  }
                  placeholder="Select a model"
                  apiEndpoint="/api/model"
                  nameField="modelname"
                  idField="modelid"
                  entityLabel="Model"
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

        <CustomFieldsSection
          entityType="accessory"
          entityId={mode === "edit" ? initialData?.accessorieid : null}
          onChange={setCustomFieldValues}
        />

        <Separator />

        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <Button asChild variant="ghost" className="w-full sm:w-auto">
            <Link href="/accessories">Cancel</Link>
          </Button>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={submitting}
          >
            {mode === "edit" ? "Save Changes" : "Create Accessory"}
          </Button>
        </div>
      </form>
    </div>
  );
}
