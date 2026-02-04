"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

export default function AccessoryCategoriesCreateForm({ initialData = null, mode = "create" }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [accessoriecategorytypename, setAccessoriecategorytypename] = useState(initialData?.accessoriecategorytypename ?? "");

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const payload: Record<string, unknown> = {
        accessoriecategorytypename,
      };

      if (mode === "edit" && initialData?.accessoriecategorytypeid) {
        payload.accessoriecategorytypeid = initialData.accessoriecategorytypeid;
      }

      const res = await fetch("/api/accessoryCategory", {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to save accessory category");
      }

      const created = await res.json();
      toast.success(mode === "edit" ? "Accessory category updated" : "Accessory category created", {
        description: created.accessoriecategorytypename,
      });
      router.push("/accessoryCategories");
    } catch (err) {
      setError(err.message);
      toast.error("Save failed", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl">
      <Toaster position="bottom-right" />
      <form onSubmit={onSubmit} className="flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold">
              {mode === "edit" ? "Edit Accessory Category" : "Create Accessory Category"}
            </h1>
            <p className="text-sm text-foreground-500 mt-1">Manage accessory classification types.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button asChild variant="ghost" className="w-full sm:w-auto">
              <Link href="/accessoryCategories">Cancel</Link>
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
              {mode === "edit" ? "Save" : "Create"}
            </Button>
          </div>
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <section className="rounded-lg border border-default-200 p-4 space-y-2">
          <Label htmlFor="accessoriecategorytypename">
            Category Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="accessoriecategorytypename"
            value={accessoriecategorytypename}
            onChange={(e) => setAccessoriecategorytypename(e.target.value)}
            required
          />
        </section>

        <Separator />

        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <Button asChild variant="ghost" className="w-full sm:w-auto">
            <Link href="/accessoryCategories">Cancel</Link>
          </Button>
          <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
            {mode === "edit" ? "Save Changes" : "Create Accessory Category"}
          </Button>
        </div>
      </form>
    </div>
  );
}
