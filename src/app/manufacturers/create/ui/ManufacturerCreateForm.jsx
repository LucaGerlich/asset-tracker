"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button, Divider, Input } from "@heroui/react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

export default function ManufacturerCreateForm({ initialData = null, mode = "create" }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [manufacturername, setManufacturername] = useState(initialData?.manufacturername ?? "");

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const payload = {
        manufacturername,
      };

      if (mode === "edit" && initialData?.manufacturerid) {
        payload.manufacturerid = initialData.manufacturerid;
      }

      const res = await fetch("/api/manufacturer", {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create manufacturer");
      }

      const created = await res.json();
      toast.success(mode === "edit" ? "Manufacturer updated" : "Manufacturer created", {
        description: created.manufacturername,
      });
      router.push("/manufacturers");
    } catch (err) {
      setError(err.message);
      toast.error("Create failed", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl">
      <Toaster position="bottom-right" />
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              {mode === "edit" ? "Edit Manufacturer" : "Create Manufacturer"}
            </h1>
            <p className="text-sm text-foreground-500 mt-1">Add a new hardware or software vendor.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button as={Link} href="/manufacturers" variant="light">
              Cancel
            </Button>
            <Button color="primary" type="submit" isLoading={submitting}>
              {mode === "edit" ? "Save" : "Create"}
            </Button>
          </div>
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <section className="rounded-lg border border-default-200 p-4">
          <Input
            label="Manufacturer Name"
            value={manufacturername}
            onChange={(e) => setManufacturername(e.target.value)}
            isRequired
          />
        </section>

        <Divider />

        <div className="flex justify-end gap-2">
          <Button as={Link} href="/manufacturers" variant="light">
            Cancel
          </Button>
          <Button color="primary" type="submit" isLoading={submitting}>
            {mode === "edit" ? "Save Changes" : "Create Manufacturer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
