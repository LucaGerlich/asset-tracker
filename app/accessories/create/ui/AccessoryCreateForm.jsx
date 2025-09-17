"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

export default function AccessoryCreateForm({ categories, locations, manufacturers, models, statuses, suppliers }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    accessoriename: "",
    accessorietag: "",
    manufacturerid: "",
    modelid: "",
    statustypeid: "",
    accessoriecategorytypeid: "",
    locationid: "",
    supplierid: "",
    purchaseprice: "",
    purchasedate: "",
    requestable: false,
  });
  const [error, setError] = useState("");

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        accessoriename: form.accessoriename.trim(),
        accessorietag: form.accessorietag.trim(),
        manufacturerid: form.manufacturerid || null,
        modelid: form.modelid || null,
        statustypeid: form.statustypeid || null,
        accessoriecategorytypeid: form.accessoriecategorytypeid || null,
        locationid: form.locationid || null,
        supplierid: form.supplierid || null,
        requestable: form.requestable,
        purchaseprice: form.purchaseprice === "" ? null : form.purchaseprice,
        purchasedate: form.purchasedate || null,
      };

      const res = await fetch("/api/accessories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to create accessory");
      }

      const created = await res.json();
      toast.success("Accessory created", { description: created.accessorietag ?? created.accessorieid });
      router.push("/accessories");
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Create Accessory</h1>
            <p className="text-sm text-muted-foreground mt-1">Provide the accessory details below.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="light" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
        <Separator />

        <div className="grid gap-6 md:grid-cols-3">
          <section className="col-span-1 rounded-lg border p-4">
            <h2 className="text-sm font-semibold mb-3">Basic Info</h2>
            <div className="flex flex-col gap-3">
              <Input name="accessoriename" value={form.accessoriename} onChange={onChange} placeholder="Accessory Name" required />
              <Input name="accessorietag" value={form.accessorietag} onChange={onChange} placeholder="Tag" required />
              <select
                name="accessoriecategorytypeid"
                value={form.accessoriecategorytypeid}
                onChange={onChange}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                required
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.accessoriecategorytypeid} value={c.accessoriecategorytypeid}>
                    {c.accessoriecategorytypename}
                  </option>
                ))}
              </select>
              <select
                name="statustypeid"
                value={form.statustypeid}
                onChange={onChange}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                required
              >
                <option value="">Select status</option>
                {statuses.map((s) => (
                  <option key={s.statustypeid} value={s.statustypeid}>
                    {s.statustypename}
                  </option>
                ))}
              </select>
              <select
                name="locationid"
                value={form.locationid}
                onChange={onChange}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                required
              >
                <option value="">Select location</option>
                {locations.map((l) => (
                  <option key={l.locationid} value={l.locationid}>
                    {l.locationname}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={form.requestable}
                  onCheckedChange={(value) => setForm((prev) => ({ ...prev, requestable: Boolean(value) }))}
                  id="requestable"
                />
                <label htmlFor="requestable" className="text-sm">Requestable</label>
              </div>
            </div>
          </section>

          <section className="col-span-1 rounded-lg border p-4">
            <h2 className="text-sm font-semibold mb-3">Specifications</h2>
            <div className="flex flex-col gap-3">
              <select
                name="manufacturerid"
                value={form.manufacturerid}
                onChange={onChange}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                required
              >
                <option value="">Select manufacturer</option>
                {manufacturers.map((m) => (
                  <option key={m.manufacturerid} value={m.manufacturerid}>
                    {m.manufacturername}
                  </option>
                ))}
              </select>
              <select
                name="modelid"
                value={form.modelid}
                onChange={onChange}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                required
              >
                <option value="">Select model</option>
                {models.map((m) => (
                  <option key={m.modelid} value={m.modelid}>
                    {m.modelname}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="col-span-1 rounded-lg border p-4">
            <h2 className="text-sm font-semibold mb-3">Procurement</h2>
            <div className="flex flex-col gap-3">
              <select
                name="supplierid"
                value={form.supplierid}
                onChange={onChange}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                required
              >
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s.supplierid} value={s.supplierid}>
                    {s.suppliername}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                name="purchaseprice"
                value={form.purchaseprice}
                onChange={onChange}
                placeholder="Purchase price"
                min="0"
                step="0.01"
              />
              <Input type="date" name="purchasedate" value={form.purchasedate} onChange={onChange} />
            </div>
          </section>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="light" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create"}
          </Button>
        </div>
      </form>
    </div>
  );
}
