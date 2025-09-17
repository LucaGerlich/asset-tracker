"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

export default function AssetEditForm({ initial, categories, locations, manufacturers, models, statuses, suppliers }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [assettagTaken, setAssettagTaken] = useState(false);
  const [serialTaken, setSerialTaken] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [form, setForm] = useState({
    assetid: initial.assetid,
    assetname: initial.assetname ?? "",
    assettag: initial.assettag ?? "",
    serialnumber: initial.serialnumber ?? "",
    modelid: initial.modelid ?? "",
    specs: initial.specs ?? "",
    notes: initial.notes ?? "",
    purchaseprice: initial.purchaseprice ?? "",
    purchasedate: initial.purchasedate ? new Date(initial.purchasedate).toISOString().slice(0, 10) : "",
    mobile: Boolean(initial.mobile),
    requestable: Boolean(initial.requestable),
    assetcategorytypeid: initial.assetcategorytypeid ?? "",
    statustypeid: initial.statustypeid ?? "",
    supplierid: initial.supplierid ?? "",
    locationid: initial.locationid ?? "",
    manufacturerid: initial.manufacturerid ?? "",
  });

  const initialSnapshot = useMemo(() => JSON.stringify({
    assetname: initial.assetname ?? "",
    assettag: initial.assettag ?? "",
    serialnumber: initial.serialnumber ?? "",
    modelid: initial.modelid ?? "",
    specs: initial.specs ?? "",
    notes: initial.notes ?? "",
    purchaseprice: initial.purchaseprice ?? "",
    purchasedate: initial.purchasedate ? new Date(initial.purchasedate).toISOString().slice(0, 10) : "",
    mobile: Boolean(initial.mobile),
    requestable: Boolean(initial.requestable),
    assetcategorytypeid: initial.assetcategorytypeid ?? "",
    statustypeid: initial.statustypeid ?? "",
    supplierid: initial.supplierid ?? "",
    locationid: initial.locationid ?? "",
    manufacturerid: initial.manufacturerid ?? "",
  }), [initial]);

  useEffect(() => {
    setIsDirty(JSON.stringify({ ...form }) !== initialSnapshot);
  }, [form, initialSnapshot]);

  useEffect(() => {
    const beforeUnload = (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSelectChange = (name) => (keys) => {
    const value = Array.from(keys)[0] || "";
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
        body: JSON.stringify({
          ...form,
          // Convert empty strings to nulls for optional fields
          modelid: form.modelid || null,
          specs: form.specs || null,
          notes: form.notes || null,
          purchaseprice: form.purchaseprice === "" ? null : form.purchaseprice,
          purchasedate: form.purchasedate || null,
          assetcategorytypeid: form.assetcategorytypeid || null,
          statustypeid: form.statustypeid || null,
          supplierid: form.supplierid || null,
          locationid: form.locationid || null,
          manufacturerid: form.manufacturerid || null,
        }),
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

  return (
    <div className="max-w-5xl">
      <Toaster position="bottom-right" />
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Edit: {initial.assetname}</h1>
            <p className="text-sm text-foreground-500 mt-1">Asset Tag {initial.assettag} • Serial {initial.serialnumber}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="light" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={saving || assettagTaken || serialTaken}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>
        <Separator />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Summary</h2>
            <div className="grid grid-cols-1 gap-3">
              <Input name="assetname" value={form.assetname} onChange={onChange} placeholder="Asset Name" required />
              <Select value={form.assetcategorytypeid} onChange={(e)=> setForm((f)=>({...f, assetcategorytypeid: e.target.value}))}>
                <option value="">Select category</option>
                {categories.map((c) => (
                  <SelectItem key={c.assetcategorytypeid} value={c.assetcategorytypeid}>{c.assetcategorytypename}</SelectItem>
                ))}
              </Select>
              <Select value={form.statustypeid} onChange={(e)=> setForm((f)=>({...f, statustypeid: e.target.value}))}>
                <option value="">Select status</option>
                {statuses.map((s) => (
                  <SelectItem key={s.statustypeid} value={s.statustypeid}>{s.statustypename}</SelectItem>
                ))}
              </Select>
              <Select value={form.locationid} onChange={(e)=> setForm((f)=>({...f, locationid: e.target.value}))}>
                <option value="">Select location</option>
                {locations.map((l) => (
                  <SelectItem key={l.locationid} value={l.locationid}>{l.locationname}</SelectItem>
                ))}
              </Select>
              <div className="flex gap-6">
                <Checkbox checked={form.requestable} onChange={(e) => setForm((f) => ({ ...f, requestable: e.target.checked }))}>Requestable</Checkbox>
                <Checkbox checked={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.checked }))}>Mobile</Checkbox>
              </div>
            </div>
          </section>

          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Specifications</h2>
            <div className="grid grid-cols-1 gap-3">
              <Select value={form.manufacturerid} onChange={(e)=> setForm((f)=>({...f, manufacturerid: e.target.value}))}>
                <option value="">Select manufacturer</option>
                {manufacturers.map((m) => (
                  <SelectItem key={m.manufacturerid} value={m.manufacturerid}>{m.manufacturername}</SelectItem>
                ))}
              </Select>
              <Select value={form.modelid} onChange={(e)=> setForm((f)=>({...f, modelid: e.target.value}))}>
                <option value="">Select model</option>
                {models.map((m) => (
                  <SelectItem key={m.modelid} value={m.modelid}>{m.modelname}</SelectItem>
                ))}
              </Select>
              <Textarea name="specs" value={form.specs ?? ""} onChange={onChange} rows={3} />
              <Textarea name="notes" value={form.notes ?? ""} onChange={onChange} rows={3} />
            </div>
          </section>

          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Procurement</h2>
            <div className="grid grid-cols-1 gap-3">
              <Select value={form.supplierid} onChange={(e)=> setForm((f)=>({...f, supplierid: e.target.value}))}>
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <SelectItem key={s.supplierid} value={s.supplierid}>{s.suppliername}</SelectItem>
                ))}
              </Select>
              <Input name="purchaseprice" value={form.purchaseprice ?? ""} onChange={onChange} type="number" step="0.01" placeholder="Purchase Price" />
              <Input name="purchasedate" value={form.purchasedate ?? ""} onChange={onChange} type="date" />
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Identifiers</h2>
            <div className="grid grid-cols-1 gap-3">
              <Input
                name="assettag"
                value={form.assettag}
                onChange={onChange}
                onBlur={async () => {
                  if (!form.assettag || form.assettag === (initial.assettag ?? "")) return;
                  try {
                    const res = await fetch(`/api/asset/validate?assettag=${encodeURIComponent(form.assettag)}`);
                    const data = await res.json();
                    setAssettagTaken(Boolean(data?.assettag?.exists));
                  } catch {}
                }}
                aria-invalid={assettagTaken}
                required
              />
              <Input
                name="serialnumber"
                value={form.serialnumber}
                onChange={onChange}
                onBlur={async () => {
                  if (!form.serialnumber || form.serialnumber === (initial.serialnumber ?? "")) return;
                  try {
                    const res = await fetch(`/api/asset/validate?serialnumber=${encodeURIComponent(form.serialnumber)}`);
                    const data = await res.json();
                    setSerialTaken(Boolean(data?.serialnumber?.exists));
                  } catch {}
                }}
                aria-invalid={serialTaken}
                required
              />
            </div>
          </section>
        </div>

        {error && <p className="text-red-500 text-sm" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="light" onPress={() => {
            if (!isDirty || confirm("Discard unsaved changes?")) router.back();
          }}>Cancel</Button>
          <Button color="primary" type="submit" isLoading={saving} isDisabled={assettagTaken || serialTaken}>Save</Button>
        </div>
      </form>
    </div>
  );
}
