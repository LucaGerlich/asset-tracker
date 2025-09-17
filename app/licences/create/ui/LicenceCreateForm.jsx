"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

export default function LicenceCreateForm({ categories, manufacturers, suppliers, users }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    licencekey: "",
    licenceduserid: "",
    licensedtoemail: "",
    licencecategorytypeid: "",
    manufacturerid: "",
    supplierid: "",
    purchaseprice: "",
    purchasedate: "",
    expirationdate: "",
    notes: "",
    requestable: false,
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
        licencekey: form.licencekey || null,
        licenceduserid: form.licenceduserid || null,
        licensedtoemail: form.licensedtoemail || null,
        licencecategorytypeid: form.licencecategorytypeid || null,
        manufacturerid: form.manufacturerid || null,
        supplierid: form.supplierid || null,
        purchaseprice: form.purchaseprice === "" ? null : form.purchaseprice,
        purchasedate: form.purchasedate || null,
        expirationdate: form.expirationdate || null,
        notes: form.notes || null,
        requestable: form.requestable,
      };

      const res = await fetch("/api/licence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to create licence");
      }

      const created = await res.json();
      toast.success("Licence created", { description: created.licencekey ?? created.licenceid });
      router.push("/licences");
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
            <h1 className="text-2xl font-semibold">Create Licence</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter licence details and assignment.</p>
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
            <h2 className="text-sm font-semibold mb-3">Identification</h2>
            <div className="flex flex-col gap-3">
              <Input name="licencekey" value={form.licencekey} onChange={onChange} placeholder="Licence key" />
              <Input name="licensedtoemail" type="email" value={form.licensedtoemail} onChange={onChange} placeholder="Licensed to (email)" />
              <select
                name="licenceduserid"
                value={form.licenceduserid}
                onChange={onChange}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Assign to user (optional)</option>
                {users.map((u) => (
                  <option key={u.userid} value={u.userid}>
                    {u.firstname} {u.lastname}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={form.requestable}
                  onCheckedChange={(value) => setForm((prev) => ({ ...prev, requestable: Boolean(value) }))}
                  id="licence-requestable"
                />
                <label htmlFor="licence-requestable" className="text-sm">Requestable</label>
              </div>
            </div>
          </section>

          <section className="col-span-1 rounded-lg border p-4">
            <h2 className="text-sm font-semibold mb-3">Classification</h2>
            <div className="flex flex-col gap-3">
              <select
                name="licencecategorytypeid"
                value={form.licencecategorytypeid}
                onChange={onChange}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                required
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.licencecategorytypeid} value={c.licencecategorytypeid}>
                    {c.licencecategorytypename}
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
          </section>

          <section className="col-span-1 rounded-lg border p-4">
            <h2 className="text-sm font-semibold mb-3">Lifecycle</h2>
            <div className="flex flex-col gap-3">
              <Input type="number" name="purchaseprice" value={form.purchaseprice} onChange={onChange} placeholder="Purchase price" min="0" step="0.01" />
              <Input type="date" name="purchasedate" value={form.purchasedate} onChange={onChange} />
              <Input type="date" name="expirationdate" value={form.expirationdate} onChange={onChange} />
              <Textarea name="notes" value={form.notes} onChange={onChange} rows={3} placeholder="Notes" />
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
