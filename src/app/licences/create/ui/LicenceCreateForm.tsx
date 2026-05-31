"use client";

import { useState } from "react";
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
import { toast } from "sonner";
import SelectWithQuickCreate, {
  type QuickCreateOption,
} from "@/components/SelectWithQuickCreate";
import CustomFieldsSection from "@/components/CustomFieldsSection";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";

export default function LicenceCreateForm({
  categories: initialCategories,
  manufacturers: initialManufacturers,
  suppliers: initialSuppliers,
  users,
  initialData = null,
  mode = "create",
}) {
  const [categoryOptions, setCategoryOptions] = useState<QuickCreateOption[]>(
    () =>
      initialCategories.map((c: any) => ({
        id: c.licencecategorytypeid,
        label: c.licencecategorytypename,
      })),
  );
  const [manufacturerOptions, setManufacturerOptions] = useState<
    QuickCreateOption[]
  >(() =>
    initialManufacturers.map((m: any) => ({
      id: m.manufacturerid,
      label: m.manufacturername,
    })),
  );
  const [supplierOptions, setSupplierOptions] = useState<QuickCreateOption[]>(
    () =>
      initialSuppliers.map((s: any) => ({
        id: s.supplierid,
        label: s.suppliername,
      })),
  );
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [customFieldValues, setCustomFieldValues] = useState<
    Record<string, string | null>
  >({});
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
      licenceduserid: initialData.licenceduserid ?? "__none__",
      licensedtoemail: initialData.licensedtoemail ?? "",
      licencecategorytypeid: initialData.licencecategorytypeid ?? "",
      manufacturerid: initialData.manufacturerid ?? "",
      supplierid: initialData.supplierid ?? "",
      purchaseprice:
        initialData.purchaseprice === null ||
        initialData.purchaseprice === undefined
          ? ""
          : String(initialData.purchaseprice),
      purchasedate: initialData.purchasedate
        ? initialData.purchasedate.slice(0, 10)
        : "",
      expirationdate: initialData.expirationdate
        ? initialData.expirationdate.slice(0, 10)
        : "",
      requestable: Boolean(initialData.requestable ?? true),
      notes: initialData.notes ?? "",
    };
  });

  const isDirty = mode === "create" ? form.licencekey !== "" : true;
  useUnsavedChanges(isDirty);

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
        licenceduserid:
          form.licenceduserid === "__none__"
            ? null
            : form.licenceduserid || null,
        purchasedate: form.purchasedate || null,
        expirationdate: form.expirationdate || null,
        purchaseprice: form.purchaseprice === "" ? null : form.purchaseprice,
        requestable: Boolean(form.requestable),
        notes: form.notes || null,
        licensedtoemail: form.licensedtoemail || null,
      };

      if (mode === "edit" && initialData?.licenceid) {
        payload.licenceid = initialData.licenceid;
        payload._expectedVersion = initialData.change_date ?? null;
      }

      const res = await fetch("/api/licence", {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const err = await res.json().catch(() => ({}));
        toast.error(
          err.error ||
            "This item was modified by someone else. Please refresh and try again.",
        );
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create licence");
      }

      const created = await res.json();
      if (mode === "create" && Object.keys(customFieldValues).length > 0) {
        await fetch("/api/custom-fields/values", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityId: created.licenceid,
            entityType: "licence",
            values: customFieldValues,
          }),
        });
      }
      toast.success(mode === "edit" ? "Licence updated" : "Licence created", {
        description: created.licencekey || created.licenceid,
      });
      router.push("/licences");
      router.refresh();
    } catch (err) {
      setError(err.message);
      toast.error("Create failed", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <form onSubmit={onSubmit} className="flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl md:text-3xl">
              {mode === "edit" ? "Edit Licence" : "Create Licence"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Capture entitlement metadata to keep compliance in check.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Button asChild variant="ghost" className="w-full sm:w-auto">
              <Link href="/licences">Cancel</Link>
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

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
          <div className="rounded-lg border p-4">
            <h2 className="text-muted-foreground mb-3 text-sm font-semibold">
              Assignment
            </h2>
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
                    <SelectItem value="__none__">Unassigned</SelectItem>
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
                    setForm((prev) => ({
                      ...prev,
                      requestable: Boolean(checked),
                    }))
                  }
                />
                <Label htmlFor="requestable" className="cursor-pointer">
                  Requestable
                </Label>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <h2 className="text-muted-foreground mb-3 text-sm font-semibold">
              Catalogue
            </h2>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="licencecategorytypeid">
                  Category <span className="text-destructive">*</span>
                </Label>
                <SelectWithQuickCreate
                  id="licencecategorytypeid"
                  value={form.licencecategorytypeid}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      licencecategorytypeid: value,
                    }))
                  }
                  options={categoryOptions}
                  onItemCreated={(item) =>
                    setCategoryOptions((prev) => [...prev, item])
                  }
                  placeholder="Select a category"
                  apiEndpoint="/api/licenceCategory"
                  nameField="licencecategorytypename"
                  idField="licencecategorytypeid"
                  entityLabel="Category"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manufacturerid">
                  Manufacturer <span className="text-destructive">*</span>
                </Label>
                <SelectWithQuickCreate
                  id="manufacturerid"
                  value={form.manufacturerid}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, manufacturerid: value }))
                  }
                  options={manufacturerOptions}
                  onItemCreated={(item) =>
                    setManufacturerOptions((prev) => [...prev, item])
                  }
                  placeholder="Select a manufacturer"
                  apiEndpoint="/api/manufacturer"
                  nameField="manufacturername"
                  idField="manufacturerid"
                  entityLabel="Manufacturer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplierid">
                  Supplier <span className="text-destructive">*</span>
                </Label>
                <SelectWithQuickCreate
                  id="supplierid"
                  value={form.supplierid}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, supplierid: value }))
                  }
                  options={supplierOptions}
                  onItemCreated={(item) =>
                    setSupplierOptions((prev) => [...prev, item])
                  }
                  placeholder="Select a supplier"
                  apiEndpoint="/api/supplier"
                  nameField="suppliername"
                  idField="supplierid"
                  entityLabel="Supplier"
                />
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
          <h2 className="text-muted-foreground mb-3 text-sm font-semibold">
            Notes
          </h2>
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

        <CustomFieldsSection
          entityType="licence"
          entityId={mode === "edit" ? initialData?.licenceid : null}
          onChange={setCustomFieldValues}
        />

        <Separator />

        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <Button asChild variant="ghost" className="w-full sm:w-auto">
            <Link href="/licences">Cancel</Link>
          </Button>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={submitting}
          >
            {mode === "edit" ? "Save Changes" : "Create Licence"}
          </Button>
        </div>
      </form>
    </div>
  );
}
