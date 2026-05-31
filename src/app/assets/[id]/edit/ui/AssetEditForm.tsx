"use client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import CustomFieldsSection from "@/components/CustomFieldsSection";
import SelectWithQuickCreate, {
  type QuickCreateOption,
} from "@/components/SelectWithQuickCreate";

export default function AssetEditForm({
  initial,
  categories: initialCategories,
  locations: initialLocations,
  manufacturers: initialManufacturers,
  models: initialModels,
  statuses: initialStatuses,
  suppliers: initialSuppliers,
}) {
  const [categoryOptions, setCategoryOptions] = useState<QuickCreateOption[]>(
    () =>
      initialCategories.map((c: any) => ({
        id: c.assetcategorytypeid,
        label: c.assetcategorytypename,
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [assettagTaken, setAssettagTaken] = useState(false);
  const [serialTaken, setSerialTaken] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<
    Record<string, string | null>
  >({});

  const [form, setForm] = useState({
    assetid: initial.assetid,
    assetname: initial.assetname ?? "",
    assettag: initial.assettag ?? "",
    serialnumber: initial.serialnumber ?? "",
    modelid: initial.modelid ?? "",
    specs: initial.specs ?? "",
    notes: initial.notes ?? "",
    purchaseprice: initial.purchaseprice ?? "",
    purchasedate: initial.purchasedate
      ? new Date(initial.purchasedate).toISOString().slice(0, 10)
      : "",
    mobile: Boolean(initial.mobile),
    requestable: Boolean(initial.requestable),
    assetcategorytypeid: initial.assetcategorytypeid ?? "",
    statustypeid: initial.statustypeid ?? "",
    supplierid: initial.supplierid ?? "",
    locationid: initial.locationid ?? "",
    manufacturerid: initial.manufacturerid ?? "",
    warrantyMonths: initial.warrantyMonths ?? "",
    warrantyExpires: initial.warrantyExpires
      ? new Date(initial.warrantyExpires).toISOString().slice(0, 10)
      : "",
  });

  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        assetname: initial.assetname ?? "",
        assettag: initial.assettag ?? "",
        serialnumber: initial.serialnumber ?? "",
        modelid: initial.modelid ?? "",
        specs: initial.specs ?? "",
        notes: initial.notes ?? "",
        purchaseprice: initial.purchaseprice ?? "",
        purchasedate: initial.purchasedate
          ? new Date(initial.purchasedate).toISOString().slice(0, 10)
          : "",
        mobile: Boolean(initial.mobile),
        requestable: Boolean(initial.requestable),
        assetcategorytypeid: initial.assetcategorytypeid ?? "",
        statustypeid: initial.statustypeid ?? "",
        supplierid: initial.supplierid ?? "",
        locationid: initial.locationid ?? "",
        manufacturerid: initial.manufacturerid ?? "",
        warrantyMonths: initial.warrantyMonths ?? "",
        warrantyExpires: initial.warrantyExpires
          ? new Date(initial.warrantyExpires).toISOString().slice(0, 10)
          : "",
      }),
    [initial],
  );

  useEffect(() => {
    setIsDirty(JSON.stringify({ ...form }) !== initialSnapshot);
  }, [form, initialSnapshot]);

  useEffect(() => {
    const beforeUnload = (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSelectChange = (name) => (value) => {
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/asset", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          modelid: form.modelid || null,
          specs: form.specs || null,
          notes: form.notes || null,
          purchaseprice: form.purchaseprice === "" ? null : form.purchaseprice,
          purchasedate: form.purchasedate || null,
          assetcategorytypeid: form.assetcategorytypeid || null,
          statustypeid: form.statustypeid || null,
          supplierid: form.supplierid || null,
          locationid: form.locationid || null,
          manufacturerid: form.manufacturerid || null,
          warrantyMonths:
            form.warrantyMonths === "" ? null : Number(form.warrantyMonths),
          warrantyExpires: form.warrantyExpires || null,
          _expectedVersion: initial.change_date ?? null,
        }),
      });
      if (res.status === 409) {
        const err = await res.json().catch(() => ({}));
        toast.error(
          err.error ||
            "This item was modified by someone else. Please refresh and try again.",
        );
        setSaving(false);
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to update asset");
      }
      const updated = await res.json();
      if (Object.keys(customFieldValues).length > 0) {
        await fetch("/api/custom-fields/values", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityId: updated.assetid,
            entityType: "asset",
            values: customFieldValues,
          }),
        });
      }
      toast.success("Asset updated", { description: updated.assettag });
      router.push(`/assets/${updated.assetid}`);
    } catch (e) {
      setError(e.message);
      toast.error("Update failed", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              Edit: {initial.assetname}
            </h1>
            <p className="text-foreground-500 mt-1 text-sm">
              Asset Tag {initial.assettag} • Serial {initial.serialnumber}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!isDirty || confirm("Discard unsaved changes?"))
                  router.back();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              type="submit"
              disabled={saving || assettagTaken || serialTaken}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
        <Separator />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <section className="border-default-200 col-span-1 rounded-lg border p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Summary
            </h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="assetname">Asset Name *</Label>
                <Input
                  id="assetname"
                  name="assetname"
                  value={form.assetname}
                  onChange={onChange}
                  required
                />
              </div>
              <div>
                <Label htmlFor="assetcategorytypeid">Category</Label>
                <SelectWithQuickCreate
                  id="assetcategorytypeid"
                  value={form.assetcategorytypeid}
                  onValueChange={onSelectChange("assetcategorytypeid")}
                  options={categoryOptions}
                  onItemCreated={(item) =>
                    setCategoryOptions((prev) => [...prev, item])
                  }
                  placeholder="Select category"
                  apiEndpoint="/api/assetCategory"
                  nameField="assetcategorytypename"
                  idField="assetcategorytypeid"
                  entityLabel="Category"
                />
              </div>
              <div>
                <Label htmlFor="statustypeid">Status</Label>
                <SelectWithQuickCreate
                  id="statustypeid"
                  value={form.statustypeid}
                  onValueChange={onSelectChange("statustypeid")}
                  options={statusOptions}
                  onItemCreated={(item) =>
                    setStatusOptions((prev) => [...prev, item])
                  }
                  placeholder="Select status"
                  apiEndpoint="/api/statusType"
                  nameField="statustypename"
                  idField="statustypeid"
                  entityLabel="Status"
                />
              </div>
              <div>
                <Label htmlFor="locationid">Location</Label>
                <SelectWithQuickCreate
                  id="locationid"
                  value={form.locationid}
                  onValueChange={onSelectChange("locationid")}
                  options={locationOptions}
                  onItemCreated={(item) =>
                    setLocationOptions((prev) => [...prev, item])
                  }
                  placeholder="Select location"
                  apiEndpoint="/api/location"
                  nameField="locationname"
                  idField="locationid"
                  entityLabel="Location"
                />
              </div>
              <div className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="requestable"
                    checked={form.requestable}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, requestable: Boolean(v) }))
                    }
                  />
                  <Label htmlFor="requestable">Requestable</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="mobile"
                    checked={form.mobile}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, mobile: Boolean(v) }))
                    }
                  />
                  <Label htmlFor="mobile">Mobile</Label>
                </div>
              </div>
            </div>
          </section>

          <section className="border-default-200 col-span-1 rounded-lg border p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Specifications
            </h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="manufacturerid">Manufacturer</Label>
                <SelectWithQuickCreate
                  id="manufacturerid"
                  value={form.manufacturerid}
                  onValueChange={onSelectChange("manufacturerid")}
                  options={manufacturerOptions}
                  onItemCreated={(item) =>
                    setManufacturerOptions((prev) => [...prev, item])
                  }
                  placeholder="Select manufacturer"
                  apiEndpoint="/api/manufacturer"
                  nameField="manufacturername"
                  idField="manufacturerid"
                  entityLabel="Manufacturer"
                />
              </div>
              <div>
                <Label htmlFor="modelid">Model</Label>
                <SelectWithQuickCreate
                  id="modelid"
                  value={form.modelid}
                  onValueChange={onSelectChange("modelid")}
                  options={modelOptions}
                  onItemCreated={(item) =>
                    setModelOptions((prev) => [...prev, item])
                  }
                  placeholder="Select model"
                  apiEndpoint="/api/model"
                  nameField="modelname"
                  idField="modelid"
                  entityLabel="Model"
                />
              </div>
              <div>
                <Label htmlFor="specs">Specs</Label>
                <Textarea
                  id="specs"
                  name="specs"
                  value={form.specs ?? ""}
                  onChange={onChange}
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  value={form.notes ?? ""}
                  onChange={onChange}
                  rows={2}
                />
              </div>
            </div>
          </section>

          <section className="border-default-200 col-span-1 rounded-lg border p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Procurement
            </h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="supplierid">Supplier</Label>
                <SelectWithQuickCreate
                  id="supplierid"
                  value={form.supplierid}
                  onValueChange={onSelectChange("supplierid")}
                  options={supplierOptions}
                  onItemCreated={(item) =>
                    setSupplierOptions((prev) => [...prev, item])
                  }
                  placeholder="Select supplier"
                  apiEndpoint="/api/supplier"
                  nameField="suppliername"
                  idField="supplierid"
                  entityLabel="Supplier"
                />
              </div>
              <div>
                <Label htmlFor="purchaseprice">Purchase Price</Label>
                <Input
                  id="purchaseprice"
                  name="purchaseprice"
                  value={form.purchaseprice ?? ""}
                  onChange={onChange}
                  type="number"
                  step="0.01"
                />
              </div>
              <div>
                <Label htmlFor="purchasedate">Purchase Date</Label>
                <Input
                  id="purchasedate"
                  name="purchasedate"
                  value={form.purchasedate ?? ""}
                  onChange={onChange}
                  type="date"
                />
              </div>
              <div>
                <Label htmlFor="warrantyMonths">Warranty (months)</Label>
                <Input
                  id="warrantyMonths"
                  name="warrantyMonths"
                  value={form.warrantyMonths ?? ""}
                  onChange={onChange}
                  type="number"
                  min="0"
                />
              </div>
              <div>
                <Label htmlFor="warrantyExpires">Warranty Expires</Label>
                <Input
                  id="warrantyExpires"
                  name="warrantyExpires"
                  value={form.warrantyExpires ?? ""}
                  onChange={onChange}
                  type="date"
                />
              </div>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <section className="border-default-200 col-span-1 rounded-lg border p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Identifiers
            </h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="assettag">Asset Tag *</Label>
                <Input
                  id="assettag"
                  name="assettag"
                  value={form.assettag}
                  onChange={onChange}
                  onBlur={async () => {
                    if (
                      !form.assettag ||
                      form.assettag === (initial.assettag ?? "")
                    )
                      return;
                    try {
                      const res = await fetch(
                        `/api/asset/validate?assettag=${encodeURIComponent(form.assettag)}`,
                      );
                      const data = await res.json();
                      setAssettagTaken(Boolean(data?.assettag?.exists));
                    } catch {
                      /* validation fetch failure is non-blocking */
                    }
                  }}
                  className={assettagTaken ? "border-red-500" : ""}
                  required
                />
                {assettagTaken && (
                  <p className="mt-1 text-sm text-red-500">
                    Asset tag already exists
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="serialnumber">Serial Number *</Label>
                <Input
                  id="serialnumber"
                  name="serialnumber"
                  value={form.serialnumber}
                  onChange={onChange}
                  onBlur={async () => {
                    if (
                      !form.serialnumber ||
                      form.serialnumber === (initial.serialnumber ?? "")
                    )
                      return;
                    try {
                      const res = await fetch(
                        `/api/asset/validate?serialnumber=${encodeURIComponent(form.serialnumber)}`,
                      );
                      const data = await res.json();
                      setSerialTaken(Boolean(data?.serialnumber?.exists));
                    } catch {
                      /* validation fetch failure is non-blocking */
                    }
                  }}
                  className={serialTaken ? "border-red-500" : ""}
                  required
                />
                {serialTaken && (
                  <p className="mt-1 text-sm text-red-500">
                    Serial number already exists
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <CustomFieldsSection
            entityType="asset"
            entityId={initial.assetid}
            onChange={setCustomFieldValues}
          />
        </div>

        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!isDirty || confirm("Discard unsaved changes?"))
                router.back();
            }}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            type="submit"
            disabled={saving || assettagTaken || serialTaken}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}
