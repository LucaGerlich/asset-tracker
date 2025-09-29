"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button, Divider, Input, Select, SelectItem } from "@heroui/react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

const SALUTATION_OPTIONS = ["Mr", "Ms", "Mx", "Dr", "Prof"];

export default function SupplierCreateForm({ initialData = null, mode = "create" }) {
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
        salutation: form.salutation || null,
        firstname: form.firstname || null,
        lastname: form.lastname || null,
        email: form.email || null,
        phonenumber: form.phonenumber || null,
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
    } catch (err) {
      setError(err.message);
      toast.error("Create failed", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <Toaster position="bottom-right" />
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              {mode === "edit" ? "Edit Supplier" : "Create Supplier"}
            </h1>
            <p className="text-sm text-foreground-500 mt-1">Keep procurement contacts close for reorders.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button as={Link} href="/suppliers" variant="light">
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
              label="Supplier Name"
              name="suppliername"
              value={form.suppliername}
              onChange={onChange}
              isRequired
            />
            <Select
              label="Salutation"
              placeholder="Select"
              selectedKeys={new Set(form.salutation ? [form.salutation] : [])}
              onSelectionChange={(keys) =>
                setForm((prev) => ({ ...prev, salutation: Array.from(keys)[0] || "" }))
              }
            >
              {SALUTATION_OPTIONS.map((option) => (
                <SelectItem key={option}>{option}</SelectItem>
              ))}
            </Select>
            <Input label="First Name" name="firstname" value={form.firstname} onChange={onChange} />
            <Input label="Last Name" name="lastname" value={form.lastname} onChange={onChange} />
            <Input label="Email" name="email" type="email" value={form.email} onChange={onChange} />
            <Input label="Phone" name="phonenumber" value={form.phonenumber} onChange={onChange} />
          </div>
        </section>

        <Divider />

        <div className="flex justify-end gap-2">
          <Button as={Link} href="/suppliers" variant="light">
            Cancel
          </Button>
          <Button color="primary" type="submit" isLoading={submitting}>
            {mode === "edit" ? "Save Changes" : "Create Supplier"}
          </Button>
        </div>
      </form>
    </div>
  );
}
