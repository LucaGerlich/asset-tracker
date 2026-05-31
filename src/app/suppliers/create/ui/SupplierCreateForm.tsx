"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const SALUTATION_OPTIONS = ["Mr", "Ms", "Mx", "Dr", "Prof"];

export default function SupplierCreateForm({
  initialData = null,
  mode = "create",
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => ({
    suppliername: initialData?.suppliername ?? "",
    salutation: initialData?.salutation ?? "",
    firstname: initialData?.firstname ?? "",
    lastname: initialData?.lastname ?? "",
    email: initialData?.email ?? "",
    phonenumber: initialData?.phonenumber ?? "",
    website: initialData?.website ?? "",
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
      const payload: Record<string, unknown> = {
        ...form,
        salutation: form.salutation || null,
        firstname: form.firstname || null,
        lastname: form.lastname || null,
        email: form.email || null,
        phonenumber: form.phonenumber || null,
        website: form.website || null,
      };

      if (mode === "edit" && initialData?.supplierid) {
        payload.supplierid = initialData.supplierid;
      }

      const res = await fetch("/api/supplier", {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create supplier");
      }

      const created = await res.json();
      toast.success(mode === "edit" ? "Supplier updated" : "Supplier created", {
        description: created.suppliername,
      });
      router.push("/suppliers");
      router.refresh();
    } catch (err) {
      setError(err.message);
      toast.error("Create failed", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <form onSubmit={onSubmit} className="flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl md:text-3xl">
              {mode === "edit" ? "Edit Supplier" : "Create Supplier"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Keep procurement contacts close for reorders.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Button asChild variant="ghost" className="w-full sm:w-auto">
              <Link href="/suppliers">Cancel</Link>
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

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <section className="rounded-lg border p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="suppliername">
                Supplier Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="suppliername"
                name="suppliername"
                value={form.suppliername}
                onChange={onChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salutation">Salutation</Label>
              <Select
                value={form.salutation}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, salutation: value }))
                }
              >
                <SelectTrigger id="salutation">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {SALUTATION_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="firstname">First Name</Label>
              <Input
                id="firstname"
                name="firstname"
                value={form.firstname}
                onChange={onChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastname">Last Name</Label>
              <Input
                id="lastname"
                name="lastname"
                value={form.lastname}
                onChange={onChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={onChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phonenumber">Phone</Label>
              <Input
                id="phonenumber"
                name="phonenumber"
                value={form.phonenumber}
                onChange={onChange}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                type="url"
                placeholder="https://example.com"
                value={form.website}
                onChange={onChange}
              />
            </div>
          </div>
        </section>

        <Separator />

        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <Button asChild variant="ghost" className="w-full sm:w-auto">
            <Link href="/suppliers">Cancel</Link>
          </Button>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={submitting}
          >
            {mode === "edit" ? "Save Changes" : "Create Supplier"}
          </Button>
        </div>
      </form>
    </div>
  );
}
