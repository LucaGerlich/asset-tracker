"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Button,
  Divider,
  Input,
  Select,
  SelectItem,
} from "@heroui/react";
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
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              {mode === "edit" ? "Edit Consumable" : "Create Consumable"}
            </h1>
            <p className="text-sm text-foreground-500 mt-1">Track recurring purchases with clear sourcing details.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button as={Link} href="/consumables" variant="light">
              Cancel
            </Button>
            <Button color="primary" type="submit" isLoading={submitting}>
              {mode === "edit" ? "Save" : "Create"}
            </Button>
          </div>
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <section className="rounded-lg border border-default-200 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              label="Consumable Name"
              name="consumablename"
              value={form.consumablename}
              onChange={onChange}
              isRequired
            />
            <Select
              label="Category"
              placeholder="Select a category"
              selectedKeys={new Set(form.consumablecategorytypeid ? [form.consumablecategorytypeid] : [])}
              onSelectionChange={onSelectChange("consumablecategorytypeid")}
              isRequired
            >
              {categories.map((category) => (
                <SelectItem key={category.consumablecategorytypeid}>
                  {category.consumablecategorytypename}
                </SelectItem>
              ))}
            </Select>
            <Select
              label="Manufacturer"
              placeholder="Select a manufacturer"
              selectedKeys={new Set(form.manufacturerid ? [form.manufacturerid] : [])}
              onSelectionChange={onSelectChange("manufacturerid")}
              isRequired
            >
              {manufacturers.map((manufacturer) => (
                <SelectItem key={manufacturer.manufacturerid}>
                  {manufacturer.manufacturername}
                </SelectItem>
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
              min={0}
              step="0.01"
              value={form.purchaseprice}
              onChange={onChange}
            />
            <Input
              label="Purchase Date"
              name="purchasedate"
              type="date"
              value={form.purchasedate}
              onChange={onChange}
            />
          </div>
        </section>

        <Divider />

        <div className="flex justify-end gap-2">
          <Button as={Link} href="/consumables" variant="light">
            Cancel
          </Button>
          <Button color="primary" type="submit" isLoading={submitting}>
            {mode === "edit" ? "Save Changes" : "Create Consumable"}
          </Button>
        </div>
      </form>
    </div>
  );
}
