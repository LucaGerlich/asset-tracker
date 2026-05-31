"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function StatusTypeCreateForm({
  initialData = null,
  mode = "create",
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [statustypename, setStatustypename] = useState(
    initialData?.statustypename ?? "",
  );
  const [color, setColor] = useState(initialData?.color ?? "#6b7280");
  const [isDefault, setIsDefault] = useState(Boolean(initialData?.isDefault));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const payload: Record<string, unknown> = {
        statustypename,
        color,
        isDefault,
      };

      if (mode === "edit" && initialData?.statustypeid) {
        payload.statustypeid = initialData.statustypeid;
      }

      const res = await fetch("/api/statusType", {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to save status type");
      }

      const created = await res.json();
      toast.success(
        mode === "edit" ? "Status type updated" : "Status type created",
        {
          description: created.statustypename,
        },
      );
      router.push("/statusTypes");
    } catch (err) {
      setError(err.message);
      toast.error("Save failed", { description: err.message });
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
              {mode === "edit" ? "Edit Status Type" : "Create Status Type"}
            </h1>
            <p className="text-foreground-500 mt-1 text-sm">
              Manage status types.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Button asChild variant="ghost" className="w-full sm:w-auto">
              <Link href="/statusTypes">Cancel</Link>
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

        <section className="border-default-200 space-y-4 rounded-lg border p-4">
          <div>
            <Label htmlFor="statustypename">
              Status Type Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="statustypename"
              value={statustypename}
              onChange={(e) => setStatustypename(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center gap-3">
            <div>
              <Label htmlFor="color">Color</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  id="color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-14 cursor-pointer p-1"
                />
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: color }}
                >
                  {statustypename || "Preview"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="isDefault">Default Status</Label>
              <p className="text-muted-foreground text-xs">
                Automatically assigned to new assets
              </p>
            </div>
            <Switch
              id="isDefault"
              checked={isDefault}
              onCheckedChange={setIsDefault}
            />
          </div>
        </section>

        <Separator />

        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <Button asChild variant="ghost" className="w-full sm:w-auto">
            <Link href="/statusTypes">Cancel</Link>
          </Button>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={submitting}
          >
            {mode === "edit" ? "Save Changes" : "Create Status Type"}
          </Button>
        </div>
      </form>
    </div>
  );
}
