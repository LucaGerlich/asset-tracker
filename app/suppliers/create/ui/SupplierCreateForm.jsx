"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

export default function SupplierCreateForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    suppliername: "",
    salutation: "",
    firstname: "",
    lastname: "",
    email: "",
    phonenumber: "",
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
      const res = await fetch("/api/supplier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suppliername: form.suppliername.trim(),
          salutation: form.salutation || null,
          firstname: form.firstname || null,
          lastname: form.lastname || null,
          email: form.email || null,
          phonenumber: form.phonenumber || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to create supplier");
      }

      const created = await res.json();
      toast.success("Supplier created", { description: created.suppliername });
      router.push("/suppliers");
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
            <h1 className="text-2xl font-semibold">Create Supplier</h1>
            <p className="text-sm text-muted-foreground mt-1">Capture supplier contact details.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="light" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !form.suppliername.trim()}>
              {submitting ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
        <Separator />

        <section className="rounded-lg border p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              name="suppliername"
              value={form.suppliername}
              onChange={onChange}
              placeholder="Supplier name"
              required
            />
            <Input name="salutation" value={form.salutation} onChange={onChange} placeholder="Salutation" />
            <Input name="firstname" value={form.firstname} onChange={onChange} placeholder="First name" />
            <Input name="lastname" value={form.lastname} onChange={onChange} placeholder="Last name" />
            <Input name="email" type="email" value={form.email} onChange={onChange} placeholder="Email" />
            <Input name="phonenumber" value={form.phonenumber} onChange={onChange} placeholder="Phone number" />
          </div>
        </section>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="light" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !form.suppliername.trim()}>
            {submitting ? "Creating..." : "Create"}
          </Button>
        </div>
      </form>
    </div>
  );
}
