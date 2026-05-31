"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function ManufacturerCreateForm({
  initialData = null,
  mode = "create",
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [manufacturername, setManufacturername] = useState(
    initialData?.manufacturername ?? "",
  );

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const payload: Record<string, unknown> = {
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
      toast.success(
        mode === "edit" ? "Manufacturer updated" : "Manufacturer created",
        {
          description: created.manufacturername,
        },
      );
      router.push("/manufacturers");
      router.refresh();
    } catch (err) {
      setError(err.message);
      toast.error("Create failed", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl">
      <form onSubmit={onSubmit} className="flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl md:text-3xl">
              {mode === "edit" ? "Edit Manufacturer" : "Create Manufacturer"}
            </h1>
            <p className="text-foreground-500 mt-1 text-sm">
              Add a new hardware or software vendor.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Button asChild variant="ghost" className="w-full sm:w-auto">
              <Link href="/manufacturers">Cancel</Link>
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={submitting}
            >
              {mode === "edit" ? "Save" : "Create"}
            </Button>
          </div>
        </div>

        {error ? <p className="text-danger text-sm">{error}</p> : null}

        <section className="border-default-200 space-y-2 rounded-lg border p-4">
          <Label htmlFor="manufacturername">
            Manufacturer Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="manufacturername"
            value={manufacturername}
            onChange={(e) => setManufacturername(e.target.value)}
            required
          />
        </section>

        <Separator />

        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <Button asChild variant="ghost" className="w-full sm:w-auto">
            <Link href="/manufacturers">Cancel</Link>
          </Button>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={submitting}
          >
            {mode === "edit" ? "Save Changes" : "Create Manufacturer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
