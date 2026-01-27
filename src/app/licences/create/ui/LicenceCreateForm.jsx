"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

export default function LicenceCreateForm({
  categories,
  manufacturers,
  suppliers,
  users,
  initialData = null,
  mode = "create",
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => {
    if (!initialData) {
      return {
        licencekey: "",
        licenceduserid: "",
        licensedtoemail: "",
        licencecategorytypeid: "",
        manufacturerid: "",
        supplierid: "",
        purchaseprice: "",
        purchasedate: "",
        expirationdate: "",
        requestable: true,
        notes: "",
      };
    }

    return {
      licencekey: initialData.licencekey ?? "",
      licenceduserid: initialData.licenceduserid ?? "",
      licensedtoemail: initialData.licensedtoemail ?? "",
      licencecategorytypeid: initialData.licencecategorytypeid ?? "",
      manufacturerid: initialData.manufacturerid ?? "",
      supplierid: initialData.supplierid ?? "",
      purchaseprice:
        initialData.purchaseprice === null || initialData.purchaseprice === undefined
          ? ""
          : String(initialData.purchaseprice),
      purchasedate: initialData.purchasedate ? initialData.purchasedate.slice(0, 10) : "",
      expirationdate: initialData.expirationdate ? initialData.expirationdate.slice(0, 10) : "",
      requestable: Boolean(initialData.requestable ?? true),
      notes: initialData.notes ?? "",
    };
  });

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
        licenceduserid: form.licenceduserid || null,
        purchasedate: form.purchasedate || null,
        expirationdate: form.expirationdate || null,
        purchaseprice: form.purchaseprice === "" ? null : form.purchaseprice,
        requestable: Boolean(form.requestable),
        notes: form.notes || null,
        licensedtoemail: form.licensedtoemail || null,
      };

      if (mode === "edit" && initialData?.licenceid) {
        payload.licenceid = initialData.licenceid;
      }

      const res = await fetch("/api/licence", {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create licence");
      }

      const created = await res.json();
      toast.success(mode === "edit" ? "Licence updated" : "Licence created", {
        description: created.licencekey || created.licenceid,
      });
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
      <form onSubmit={onSubmit} className="flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold">
              {mode === "edit" ? "Edit Licence" : "Create Licence"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Capture entitlement metadata to keep compliance in check.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button asChild variant="ghost" className="w-full sm:w-auto">
              <Link href="/licences">Cancel</Link>
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
              {mode === "edit" ? "Save" : "Create"}
            </Button>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="rounded-lg border p-4">
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">Assignment</h2>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="licencekey">Licence Key</Label>
                <Input
                  id="licencekey"
                  name="licencekey"
                  value={form.licencekey}
                  onChange={onChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="licenceduserid">Assigned User</Label>
                <Select
                  value={form.licenceduserid}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, licenceduserid: value }))
                  }
                >
                  <SelectTrigger id="licenceduserid">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.userid} value={user.userid}>
                        {user.firstname} {user.lastname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="licensedtoemail">Licensed To (Email)</Label>
                <Input
                  id="licensedtoemail"
                  name="licensedtoemail"
                  type="email"
                  value={form.licensedtoemail}
                  onChange={onChange}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requestable"
                  checked={form.requestable}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, requestable: checked }))
                  }
                />
                <Label htmlFor="requestable" className="cursor-pointer">Requestable</Label>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">Catalogue</h2>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="licencecategorytypeid">
                  Category <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.licencecategorytypeid}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, licencecategorytypeid: value }))
                  }
                  required
                >
                  <SelectTrigger id="licencecategorytypeid">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.licencecategorytypeid} value={category.licencecategorytypeid}>
                        {category.licencecategorytypename}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="manufacturerid">
                  Manufacturer <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.manufacturerid}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, manufacturerid: value }))
                  }
                  required
                >
                  <SelectTrigger id="manufacturerid">
                    <SelectValue placeholder="Select a manufacturer" />
                  </SelectTrigger>
                  <SelectContent>
                    {manufacturers.map((manufacturer) => (
                      <SelectItem key={manufacturer.manufacturerid} value={manufacturer.manufacturerid}>
                        {manufacturer.manufacturername}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplierid">
                  Supplier <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.supplierid}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, supplierid: value }))
                  }
                  required
                >
                  <SelectTrigger id="supplierid">
                    <SelectValue placeholder="Select a supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.supplierid} value={supplier.supplierid}>
                        {supplier.suppliername}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchaseprice">Purchase Price</Label>
                <Input
                  id="purchaseprice"
                  name="purchaseprice"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.purchaseprice}
                  onChange={onChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchasedate">Purchase Date</Label>
                <Input
                  id="purchasedate"
                  name="purchasedate"
                  type="date"
                  value={form.purchasedate}
                  onChange={onChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expirationdate">Expiration Date</Label>
                <Input
                  id="expirationdate"
                  name="expirationdate"
                  type="date"
                  value={form.expirationdate}
                  onChange={onChange}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Notes</h2>
          <div className="space-y-2">
            <Textarea
              id="notes"
              name="notes"
              placeholder="Licence scope, seats, or additional context"
              value={form.notes}
              onChange={onChange}
              rows={3}
            />
          </div>
        </section>

        <Separator />

        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <Button asChild variant="ghost" className="w-full sm:w-auto">
            <Link href="/licences">Cancel</Link>
          </Button>
          <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
            {mode === "edit" ? "Save Changes" : "Create Licence"}
          </Button>
        </div>
      </form>
    </div>
  );
}
