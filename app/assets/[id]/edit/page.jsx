"use client";
import React, { useEffect, useState } from "react";
import { Button, Input, Checkbox, Card, CardHeader, CardBody } from "@nextui-org/react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

export default function Page({ params }) {
  const router = useRouter();
  const { id } = params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    assetid: id,
    assetname: "",
    assettag: "",
    serialnumber: "",
    requestable: false,
    mobile: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchAsset = async () => {
      try {
        const res = await fetch(`/api/asset?id=${id}`);
        if (!res.ok) throw new Error("Failed to load asset");
        const data = await res.json();
        setForm((f) => ({
          ...f,
          assetid: data.assetid,
          assetname: data.assetname ?? "",
          assettag: data.assettag ?? "",
          serialnumber: data.serialnumber ?? "",
          requestable: Boolean(data.requestable),
          mobile: Boolean(data.mobile),
        }));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAsset();
  }, [id]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/asset", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to update asset");
      }
      const updated = await res.json();
      toast.success("Asset updated", { description: updated.assettag });
      router.push(`/assets/${updated.assetid}`);
    } catch (e) {
      setError(e.message);
      toast.error("Update failed", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-2xl">
      <Toaster position="bottom-right" />
      <Card>
        <CardHeader>Edit Asset</CardHeader>
        <CardBody>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Input label="Asset Name" name="assetname" value={form.assetname} onChange={onChange} isRequired />
            <Input label="Asset Tag" name="assettag" value={form.assettag} onChange={onChange} isRequired />
            <Input label="Serial Number" name="serialnumber" value={form.serialnumber} onChange={onChange} isRequired />
            <div className="flex gap-6">
              <Checkbox isSelected={form.requestable} onValueChange={(v) => setForm((f) => ({ ...f, requestable: v }))}>
                Requestable
              </Checkbox>
              <Checkbox isSelected={form.mobile} onValueChange={(v) => setForm((f) => ({ ...f, mobile: v }))}>
                Mobile
              </Checkbox>
            </div>
            {error && (
              <p className="text-red-500 text-sm" role="alert">{error}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="light" onPress={() => router.back()}>
                Cancel
              </Button>
              <Button color="primary" type="submit" isLoading={saving}>
                Save
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
