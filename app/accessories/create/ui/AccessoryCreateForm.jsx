"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Button,
  Checkbox,
  Divider,
  Input,
  Select,
  SelectItem,
} from "@heroui/react";
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

  const onSelectChange = (name) => (keys) => {
    const value = Array.from(keys)[0] || "";
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const payload = {
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
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              {mode === "edit" ? "Edit Accessory" : "Create Accessory"}
            </h1>
            <p className="text-sm text-foreground-500 mt-1">
              Provide identification, ownership, and lifecycle details.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button as={Link} href="/accessories" variant="light">
              Cancel
            </Button>
            <Button color="primary" type="submit" isLoading={submitting}>
              {mode === "edit" ? "Save" : "Create"}
            </Button>
          </div>
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Basics</h2>
            <div className="grid grid-cols-1 gap-3">
              <Input
                label="Accessory Name"
                name="accessoriename"
                value={form.accessoriename}
                onChange={onChange}
                isRequired
              />
              <Input
                label="Asset Tag"
                name="accessorietag"
                value={form.accessorietag}
                onChange={onChange}
                isRequired
              />
              <Select
                label="Category"
                placeholder="Select a category"
                selectedKeys={new Set(form.accessoriecategorytypeid ? [form.accessoriecategorytypeid] : [])}
                onSelectionChange={onSelectChange("accessoriecategorytypeid")}
                isRequired
              >
                {categories.map((category) => (
                  <SelectItem key={category.accessoriecategorytypeid}>
                    {category.accessoriecategorytypename}
                  </SelectItem>
                ))}
              </Select>
              <Select
                label="Status"
                placeholder="Select a status"
                selectedKeys={new Set(form.statustypeid ? [form.statustypeid] : [])}
                onSelectionChange={onSelectChange("statustypeid")}
                isRequired
              >
                {sortedStatuses.map((status) => (
                  <SelectItem key={status.statustypeid}>{status.statustypename}</SelectItem>
                ))}
              </Select>
              <Select
                label="Location"
                placeholder="Select a location"
                selectedKeys={new Set(form.locationid ? [form.locationid] : [])}
                onSelectionChange={onSelectChange("locationid")}
                isRequired
              >
                {locations.map((location) => (
                  <SelectItem key={location.locationid}>{location.locationname}</SelectItem>
                ))}
              </Select>
              <Checkbox
                isSelected={form.requestable}
                onValueChange={(value) => setForm((prev) => ({ ...prev, requestable: value }))}
              >
                Requestable
              </Checkbox>
            </div>
          </div>

          <div className="rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Procurement & Specs</h2>
            <div className="grid grid-cols-1 gap-3">
              <Select
                label="Manufacturer"
                placeholder="Select a manufacturer"
                selectedKeys={new Set(form.manufacturerid ? [form.manufacturerid] : [])}
                onSelectionChange={onSelectChange("manufacturerid")}
                isRequired
              >
                {manufacturers.map((manufacturer) => (
                  <SelectItem key={manufacturer.manufacturerid}>{manufacturer.manufacturername}</SelectItem>
                ))}
              </Select>
              <Select
                label="Model"
                placeholder="Select a model"
                selectedKeys={new Set(form.modelid ? [form.modelid] : [])}
                onSelectionChange={onSelectChange("modelid")}
                isRequired
              >
                {models.map((model) => (
                  <SelectItem key={model.modelid}>{model.modelname}</SelectItem>
                ))}
              </Select>
              <Select
                label="Supplier"
                placeholder="Select a supplier"
                selectedKeys={new Set(form.supplierid ? [form.supplierid] : [])}
                onSelectionChange={onSelectChange("supplierid")}
                isRequired
              >
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.supplierid}>{supplier.suppliername}</SelectItem>
                ))}
              </Select>
              <Input
                label="Purchase Price"
                name="purchaseprice"
                type="number"
                value={form.purchaseprice}
                onChange={onChange}
                min={0}
                step="0.01"
              />
              <Input
                label="Purchase Date"
                name="purchasedate"
                type="date"
                value={form.purchasedate}
                onChange={onChange}
              />
            </div>
          </div>
        </section>

        <Divider />

        <div className="flex justify-end gap-2">
          <Button as={Link} href="/accessories" variant="light">
            Cancel
          </Button>
          <Button color="primary" type="submit" isLoading={submitting}>
            {mode === "edit" ? "Save Changes" : "Create Accessory"}
          </Button>
        </div>
      </form>
    </div>
  );
}
