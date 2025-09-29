"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button, Divider, Input } from "@heroui/react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

export default function LocationCreateForm({ initialData = null, mode = "create" }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => ({
    locationname: initialData?.locationname ?? "",
    street: initialData?.street ?? "",
    housenumber: initialData?.housenumber ?? "",
    city: initialData?.city ?? "",
    country: initialData?.country ?? "",
  }));

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
      const payload = {
        ...form,
        street: form.street || null,
        housenumber: form.housenumber || null,
        city: form.city || null,
        country: form.country || null,
      };

      if (mode === "edit" && initialData?.locationid) {
        payload.locationid = initialData.locationid;
      }

      const res = await fetch("/api/location", {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create location");
      }

      const created = await res.json();
      toast.success(mode === "edit" ? "Location updated" : "Location created", {
        description: created.locationname,
      });
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              {mode === "edit" ? "Edit Location" : "Create Location"}
            </h1>
            <p className="text-sm text-foreground-500 mt-1">Add a new site for assets, accessories, and consumables.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button as={Link} href="/locations" variant="light">
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
              label="Location Name"
              name="locationname"
              value={form.locationname}
              onChange={onChange}
              isRequired
            />
            <Input label="Street" name="street" value={form.street} onChange={onChange} />
            <Input label="House Number" name="housenumber" value={form.housenumber} onChange={onChange} />
            <Input label="City" name="city" value={form.city} onChange={onChange} />
            <Input label="Country" name="country" value={form.country} onChange={onChange} />
          </div>
        </section>

        <Divider />

        <div className="flex justify-end gap-2">
          <Button as={Link} href="/locations" variant="light">
            Cancel
          </Button>
          <Button color="primary" type="submit" isLoading={submitting}>
            {mode === "edit" ? "Save Changes" : "Create Location"}
          </Button>
        </div>
      </form>
    </div>
  );
}
