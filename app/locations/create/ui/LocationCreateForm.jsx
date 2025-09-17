"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

export default function LocationCreateForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    locationname: "",
    street: "",
    housenumber: "",
    city: "",
    country: "",
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
        locationname: form.locationname.trim(),
        street: form.street || null,
        housenumber: form.housenumber || null,
        city: form.city || null,
        country: form.country || null,
      };

      const res = await fetch("/api/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to create location");
      }

      const created = await res.json();
      toast.success("Location created", { description: created.locationname ?? created.locationid });
      router.push("/locations");
    } catch (err) {
      setError(err.message);
      toast.error("Create failed", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <Toaster position="bottom-right" />
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Create Location</h1>
            <p className="text-sm text-muted-foreground mt-1">Add a new office or storage location.</p>
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
            <Input
              name="locationname"
              value={form.locationname}
              onChange={onChange}
              placeholder="Location name"
              required
            />
            <Input name="street" value={form.street} onChange={onChange} placeholder="Street" />
            <Input name="housenumber" value={form.housenumber} onChange={onChange} placeholder="House number" />
            <Input name="city" value={form.city} onChange={onChange} placeholder="City" />
            <Input name="country" value={form.country} onChange={onChange} placeholder="Country" />
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
