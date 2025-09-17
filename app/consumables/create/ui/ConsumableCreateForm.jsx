"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

export default function ConsumableCreateForm({ categories, manufacturers, suppliers }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    consumablename: "",
    consumablecategorytypeid: "",
    manufacturerid: "",
    supplierid: "",
    purchaseprice: "",
    purchasedate: "",
  });

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
        consumablename: form.consumablename.trim(),
        consumablecategorytypeid: form.consumablecategorytypeid || null,
        manufacturerid: form.manufacturerid || null,
        supplierid: form.supplierid || null,
        purchaseprice: form.purchaseprice === "" ? null : form.purchaseprice,
        purchasedate: form.purchasedate || null,
      };

      const res = await fetch("/api/consumable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to create consumable");
      }

      const created = await res.json();
      toast.success("Consumable created", { description: created.consumablename });
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Create Consumable</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter consumable information.</p>
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

        <section className="rounded-lg border p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <Input
                name="consumablename"
                value={form.consumablename}
                onChange={onChange}
                placeholder="Consumable name"
                required
              />
              <select
                name="consumablecategorytypeid"
                value={form.consumablecategorytypeid}
                onChange={onChange}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                required
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.consumablecategorytypeid} value={c.consumablecategorytypeid}>
                    {c.consumablecategorytypename}
                  </option>
                ))}
              </select>
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
            </div>
            <div className="flex flex-col gap-3">
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
          </div>
        </section>

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
