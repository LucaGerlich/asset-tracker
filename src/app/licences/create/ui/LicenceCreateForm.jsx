"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Button,
  Checkbox,
  Divider,
  Input,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
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

  const onSelectChange = (name) => (keys) => {
    const value = Array.from(keys)[0] || "";
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
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              {mode === "edit" ? "Edit Licence" : "Create Licence"}
            </h1>
            <p className="text-sm text-foreground-500 mt-1">Capture entitlement metadata to keep compliance in check.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button as={Link} href="/licences" variant="light">
              Cancel
            </Button>
            <Button color="primary" type="submit" isLoading={submitting}>
              {mode === "edit" ? "Save" : "Create"}
            </Button>
          </div>
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Assignment</h2>
            <div className="grid grid-cols-1 gap-3">
              <Input
                label="Licence Key"
                name="licencekey"
                value={form.licencekey}
                onChange={onChange}
              />
              <Select
                label="Assigned User"
                placeholder="Unassigned"
                selectedKeys={new Set(form.licenceduserid ? [form.licenceduserid] : [])}
                onSelectionChange={onSelectChange("licenceduserid")}
              >
                <SelectItem key="">Unassigned</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.userid}>
                    {user.firstname} {user.lastname}
                  </SelectItem>
                ))}
              </Select>
              <Input
                label="Licensed To (Email)"
                name="licensedtoemail"
                type="email"
                value={form.licensedtoemail}
                onChange={onChange}
              />
              <Checkbox
                isSelected={form.requestable}
                onValueChange={(value) => setForm((prev) => ({ ...prev, requestable: value }))}
              >
                Requestable
              </Checkbox>
            </div>
          </div>

          <div className="rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Catalogue</h2>
            <div className="grid grid-cols-1 gap-3">
              <Select
                label="Category"
                placeholder="Select a category"
                selectedKeys={new Set(form.licencecategorytypeid ? [form.licencecategorytypeid] : [])}
                onSelectionChange={onSelectChange("licencecategorytypeid")}
                isRequired
              >
                {categories.map((category) => (
                  <SelectItem key={category.licencecategorytypeid}>
                    {category.licencecategorytypename}
                  </SelectItem>
                ))}
              </Select>
              <Select
                label="Manufacturer"
                placeholder="Select a manufacturer"
                selectedKeys={new Set(form.manufacturerid ? [form.manufacturerid] : [])}
                onSelectionChange={onSelectChange("manufacturerid")}
                isRequired
              >
                {manufacturers.map((manufacturer) => (
                  <SelectItem key={manufacturer.manufacturerid}>
                    {manufacturer.manufacturername}
                  </SelectItem>
                ))}
              </Select>
              <Select
                label="Supplier"
                placeholder="Select a supplier"
                selectedKeys={new Set(form.supplierid ? [form.supplierid] : [])}
                onSelectionChange={onSelectChange("supplierid")}
                isRequired
              >
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.supplierid}>{supplier.suppliername}</SelectItem>
                ))}
              </Select>
              <Input
                label="Purchase Price"
                name="purchaseprice"
                type="number"
                min={0}
                step="0.01"
                value={form.purchaseprice}
                onChange={onChange}
              />
              <Input
                label="Purchase Date"
                name="purchasedate"
                type="date"
                value={form.purchasedate}
                onChange={onChange}
              />
              <Input
                label="Expiration Date"
                name="expirationdate"
                type="date"
                value={form.expirationdate}
                onChange={onChange}
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-default-200 p-4">
          <h2 className="text-sm font-semibold text-foreground-600 mb-3">Notes</h2>
          <Textarea
            name="notes"
            placeholder="Licence scope, seats, or additional context"
            value={form.notes}
            onChange={onChange}
            minRows={3}
          />
        </section>

        <Divider />

        <div className="flex justify-end gap-2">
          <Button as={Link} href="/licences" variant="light">
            Cancel
          </Button>
          <Button color="primary" type="submit" isLoading={submitting}>
            {mode === "edit" ? "Save Changes" : "Create Licence"}
          </Button>
        </div>
      </form>
    </div>
  );
}
