"use client";
import React, { useState } from "react";
import { Button, Input, Checkbox, Card, CardBody, CardHeader } from "@nextui-org/react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

export default function Page() {
  const router = useRouter();
  const [form, setForm] = useState({
    assetname: "",
    assettag: "",
    serialnumber: "",
    requestable: false,
    mobile: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create asset");
      }
      const created = await res.json();
      toast.success("Asset created", { description: created.assettag });
      router.push(`/assets/${created.assetid}`);
    } catch (err) {
      setError(err.message);
      toast.error("Create failed", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <Toaster position="bottom-right" />
      <Card>
        <CardHeader>Create New Asset</CardHeader>
        <CardBody>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Input
              label="Asset Name"
              name="assetname"
              value={form.assetname}
              onChange={onChange}
              isRequired
            />
            <Input
              label="Asset Tag"
              name="assettag"
              value={form.assettag}
              onChange={onChange}
              isRequired
            />
            <Input
              label="Serial Number"
              name="serialnumber"
              value={form.serialnumber}
              onChange={onChange}
              isRequired
            />
            <div className="flex gap-6">
              <Checkbox
                isSelected={form.requestable}
                onValueChange={(v) => setForm((f) => ({ ...f, requestable: v }))}
              >
                Requestable
              </Checkbox>
              <Checkbox
                isSelected={form.mobile}
                onValueChange={(v) => setForm((f) => ({ ...f, mobile: v }))}
              >
                Mobile
              </Checkbox>
            </div>
            {error && (
              <p className="text-red-500 text-sm" role="alert">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="light" onPress={() => router.back()}>
                Cancel
              </Button>
              <Button color="primary" type="submit" isLoading={submitting}>
                Create
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
