"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

export default function ManufacturerCreateForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/manufacturer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manufacturername: name.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to create manufacturer");
      }

      const created = await res.json();
      toast.success("Manufacturer created", { description: created.manufacturername });
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Create Manufacturer</h1>
            <p className="text-sm text-muted-foreground mt-1">Add a new manufacturer name.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="light" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
        <Separator />

        <section className="rounded-lg border p-4">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Manufacturer name"
            required
          />
        </section>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="light" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? "Creating..." : "Create"}
          </Button>
        </div>
      </form>
    </div>
  );
}
