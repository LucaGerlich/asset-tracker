"use client";
import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useRouter, useSearchParams } from "next/navigation";
import { Toaster, toast } from "sonner";
import { Wand2, FileText } from "lucide-react";
import CustomFieldsSection from "@/components/CustomFieldsSection";
import SelectWithQuickCreate, {
  type QuickCreateOption,
} from "@/components/SelectWithQuickCreate";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";

export default function AssetCreateForm({
  categories: initialCategories,
  locations: initialLocations,
  manufacturers: initialManufacturers,
  models: initialModels,
  statuses: initialStatuses,
  suppliers: initialSuppliers,
  users,
}) {
  // Mutable option lists for quick-create
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
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [createdAsset, setCreatedAsset] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [assettagTaken, setAssettagTaken] = useState(false);
  const [serialTaken, setSerialTaken] = useState(false);
  const [generatingTag, setGeneratingTag] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<
    Record<string, string | null>
  >({});
  const [form, setForm] = useState(() => ({
    assetname: searchParams.get("assetname") || "",
    assettag: "",
    serialnumber: "",
    modelid: searchParams.get("modelid") || "",
    specs: searchParams.get("specs") || "",
    notes: "",
    purchaseprice: searchParams.get("purchaseprice") || "",
    purchasedate: "",
    mobile: searchParams.get("mobile") === "true",
    requestable: searchParams.get("requestable") === "true",
    assetcategorytypeid: searchParams.get("assetcategorytypeid") || "",
    statustypeid: searchParams.get("statustypeid") || "",
    supplierid: searchParams.get("supplierid") || "",
    locationid: searchParams.get("locationid") || "",
    manufacturerid: searchParams.get("manufacturerid") || "",
    warrantyMonths: searchParams.get("warrantyMonths") || "",
    warrantyExpires: "",
  }));
  const isDirty =
    form.assetname !== "" || form.assettag !== "" || form.serialnumber !== "";
  useUnsavedChanges(isDirty);

  // Asset templates
  const [templates, setTemplates] = useState<
    Array<{
      id: string;
      name: string;
      description?: string | null;
      assetcategorytypeid?: string | null;
      manufacturerid?: string | null;
      modelid?: string | null;
      statustypeid?: string | null;
      locationid?: string | null;
      supplierid?: string | null;
      defaultSpecs?: string | null;
      defaultNotes?: string | null;
    }>
  >([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  useEffect(() => {
    fetch("/api/asset-templates")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setTemplates(data);
      })
      .catch(() => {});
  }, []);

  const applyTemplate = useCallback(
    (templateId: string) => {
      setSelectedTemplateId(templateId);
      if (!templateId || templateId === "__none__") return;
      const tpl = templates.find((t) => t.id === templateId);
      if (!tpl) return;
      setForm((f) => ({
        ...f,
        assetcategorytypeid: tpl.assetcategorytypeid || f.assetcategorytypeid,
        manufacturerid: tpl.manufacturerid || f.manufacturerid,
        modelid: tpl.modelid || f.modelid,
        statustypeid: tpl.statustypeid || f.statustypeid,
        locationid: tpl.locationid || f.locationid,
        supplierid: tpl.supplierid || f.supplierid,
        specs: tpl.defaultSpecs || f.specs,
        notes: tpl.defaultNotes || f.notes,
      }));
    },
    [templates],
  );

  // Preselect default status "Available" if present
  useEffect(() => {
    if (!form.statustypeid && statusOptions.length) {
      const available = statusOptions.find(
        (s) => s.label?.toLowerCase() === "available",
      );
      if (available) {
        setForm((f) => ({ ...f, statustypeid: available.id }));
      }
    }
  }, [statusOptions]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSelectChange = (name) => (value) => {
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e, assignAfter = false) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = {
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
      };
      const res = await fetch("/api/asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create asset");
      }
      const created = await res.json();
      // Save custom field values
      if (Object.keys(customFieldValues).length > 0) {
        await fetch("/api/custom-fields/values", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityId: created.assetid,
            entityType: "asset",
            values: customFieldValues,
          }),
        });
      }
      toast.success("Asset created", { description: created.assettag });
      if (assignAfter) {
        setCreatedAsset(created);
        setAssignModalOpen(true);
      } else {
        router.push(`/assets/${created.assetid}`);
      }
    } catch (err) {
      setError(err.message);
      toast.error("Create failed", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = useCallback(() => {
    setForm({
      assetname: "",
      assettag: "",
      serialnumber: "",
      modelid: "",
      specs: "",
      notes: "",
      purchaseprice: "",
      purchasedate: "",
      mobile: false,
      requestable: false,
      assetcategorytypeid: "",
      statustypeid: "",
      supplierid: "",
      locationid: "",
      manufacturerid: "",
      warrantyMonths: "",
      warrantyExpires: "",
    });
  }, []);

  return (
    <div className="max-w-5xl">
      <Toaster position="bottom-right" />
      <form
        onSubmit={(e) => onSubmit(e, false)}
        className="flex flex-col gap-4 sm:gap-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl md:text-3xl">
              Create New Asset
            </h1>
            <p className="text-foreground-500 mt-1 text-sm">
              Fill out details below
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="w-full sm:w-auto"
              type="submit"
              disabled={submitting || assettagTaken || serialTaken}
            >
              {submitting ? "Creating..." : "Create"}
            </Button>
            <Button
              variant="default"
              className="w-full shadow-lg sm:w-auto"
              disabled={submitting || assettagTaken || serialTaken}
              type="button"
              onClick={() => onSubmit({ preventDefault: () => {} }, true)}
            >
              {submitting ? "Creating..." : "Create & Assign"}
            </Button>
          </div>
        </div>

        {templates.length > 0 && (
          <div className="border-default-200 bg-muted/30 flex items-center gap-3 rounded-lg border p-3">
            <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
            <Label htmlFor="template" className="shrink-0 text-sm font-medium">
              From Template
            </Label>
            <Select value={selectedTemplateId} onValueChange={applyTemplate}>
              <SelectTrigger id="template" className="max-w-xs">
                <SelectValue placeholder="No template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No template</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                  value={form.specs}
                  onChange={onChange}
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  value={form.notes}
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
                  value={form.purchaseprice}
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
                  value={form.purchasedate}
                  onChange={onChange}
                  type="date"
                />
              </div>
              <div>
                <Label htmlFor="warrantyMonths">Warranty (months)</Label>
                <Input
                  id="warrantyMonths"
                  name="warrantyMonths"
                  value={form.warrantyMonths}
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
                  value={form.warrantyExpires}
                  onChange={onChange}
                  type="date"
                />
              </div>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          <CustomFieldsSection
            entityType="asset"
            entityId={null}
            onChange={setCustomFieldValues}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          <section className="border-default-200 col-span-1 rounded-lg border p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Identifiers
            </h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="assettag">Asset Tag *</Label>
                <div className="flex gap-1.5">
                  <Input
                    id="assettag"
                    name="assettag"
                    value={form.assettag}
                    onChange={onChange}
                    onBlur={async () => {
                      if (!form.assettag) return;
                      try {
                        const res = await fetch(
                          `/api/asset/validate?assettag=${encodeURIComponent(form.assettag)}`,
                        );
                        const data = await res.json();
                        setAssettagTaken(Boolean(data?.assettag?.exists));
                      } catch {}
                    }}
                    className={assettagTaken ? "border-red-500" : ""}
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    title={
                      !form.assetcategorytypeid
                        ? "Select a category first to generate a tag"
                        : "Generate asset tag"
                    }
                    disabled={generatingTag || !form.assetcategorytypeid}
                    onClick={async () => {
                      setGeneratingTag(true);
                      try {
                        const params = new URLSearchParams();
                        if (form.assetcategorytypeid)
                          params.set("categoryId", form.assetcategorytypeid);
                        if (form.manufacturerid)
                          params.set("manufacturerId", form.manufacturerid);
                        if (form.modelid) params.set("modelId", form.modelid);
                        const res = await fetch(
                          `/api/asset/nextTag?${params.toString()}`,
                        );
                        if (!res.ok) throw new Error("Failed to generate tag");
                        const data = await res.json();
                        setForm((f) => ({ ...f, assettag: data.tag }));
                        setAssettagTaken(false);
                      } catch (err) {
                        toast.error("Failed to generate tag");
                      } finally {
                        setGeneratingTag(false);
                      }
                    }}
                  >
                    <Wand2 className="h-4 w-4" />
                  </Button>
                </div>
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
                    if (!form.serialnumber) return;
                    try {
                      const res = await fetch(
                        `/api/asset/validate?serialnumber=${encodeURIComponent(form.serialnumber)}`,
                      );
                      const data = await res.json();
                      setSerialTaken(Boolean(data?.serialnumber?.exists));
                    } catch {}
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

        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={resetForm}
          >
            Reset
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            className="w-full sm:w-auto"
            type="submit"
            disabled={submitting || assettagTaken || serialTaken}
          >
            {submitting ? "Creating..." : "Create"}
          </Button>
          <Button
            variant="default"
            className="w-full shadow-lg sm:w-auto"
            disabled={submitting || assettagTaken || serialTaken}
            type="button"
            onClick={() => onSubmit({ preventDefault: () => {} }, true)}
          >
            {submitting ? "Creating..." : "Create & Assign"}
          </Button>
        </div>
      </form>

      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User to {createdAsset?.assetname}</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="userid">Select a user</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="userid">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.userid} value={u.userid}>
                    {u.firstname} {u.lastname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAssignModalOpen(false);
                router.push(`/assets/${createdAsset?.assetid}`);
              }}
            >
              Skip
            </Button>
            <Button
              variant="default"
              disabled={!selectedUserId}
              onClick={async () => {
                try {
                  const res = await fetch(`/api/userAssets/assign`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      assetId: createdAsset.assetid,
                      userId: selectedUserId,
                    }),
                  });
                  if (!res.ok) throw new Error("Failed to assign user");
                  toast.success("User assigned", {
                    description: createdAsset.assettag,
                  });
                } catch (e) {
                  toast.error("Assign failed", { description: e.message });
                } finally {
                  setAssignModalOpen(false);
                  router.push(`/assets/${createdAsset?.assetid}`);
                }
              }}
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
