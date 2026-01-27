"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
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

  const onSelectChange = (name) => (value) => {
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
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button variant="default" type="submit" disabled={saving || assettagTaken || serialTaken}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>
        <Separator />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Summary</h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="assetname">Asset Name *</Label>
                <Input id="assetname" name="assetname" value={form.assetname} onChange={onChange} required />
              </div>
              <div>
                <Label htmlFor="assetcategorytypeid">Category</Label>
                <Select value={form.assetcategorytypeid} onValueChange={onSelectChange("assetcategorytypeid")}>
                  <SelectTrigger id="assetcategorytypeid">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.assetcategorytypeid} value={c.assetcategorytypeid}>{c.assetcategorytypename}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="statustypeid">Status</Label>
                <Select value={form.statustypeid} onValueChange={onSelectChange("statustypeid")}>
                  <SelectTrigger id="statustypeid">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s.statustypeid} value={s.statustypeid}>{s.statustypename}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="locationid">Location</Label>
                <Select value={form.locationid} onValueChange={onSelectChange("locationid")}>
                  <SelectTrigger id="locationid">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.locationid} value={l.locationid}>{l.locationname}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox id="requestable" checked={form.requestable} onCheckedChange={(v) => setForm((f) => ({ ...f, requestable: Boolean(v) }))} />
                  <Label htmlFor="requestable">Requestable</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="mobile" checked={form.mobile} onCheckedChange={(v) => setForm((f) => ({ ...f, mobile: Boolean(v) }))} />
                  <Label htmlFor="mobile">Mobile</Label>
                </div>
              </div>
            </div>
          </section>

          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Specifications</h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="manufacturerid">Manufacturer</Label>
                <Select value={form.manufacturerid} onValueChange={onSelectChange("manufacturerid")}>
                  <SelectTrigger id="manufacturerid">
                    <SelectValue placeholder="Select manufacturer" />
                  </SelectTrigger>
                  <SelectContent>
                    {manufacturers.map((m) => (
                      <SelectItem key={m.manufacturerid} value={m.manufacturerid}>{m.manufacturername}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="modelid">Model</Label>
                <Select value={form.modelid} onValueChange={onSelectChange("modelid")}>
                  <SelectTrigger id="modelid">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.modelid} value={m.modelid}>{m.modelname}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="specs">Specs</Label>
                <Textarea id="specs" name="specs" value={form.specs ?? ""} onChange={onChange} rows={2} />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" value={form.notes ?? ""} onChange={onChange} rows={2} />
              </div>
            </div>
          </section>

          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Procurement</h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="supplierid">Supplier</Label>
                <Select value={form.supplierid} onValueChange={onSelectChange("supplierid")}>
                  <SelectTrigger id="supplierid">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.supplierid} value={s.supplierid}>{s.suppliername}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="purchaseprice">Purchase Price</Label>
                <Input id="purchaseprice" name="purchaseprice" value={form.purchaseprice ?? ""} onChange={onChange} type="number" step="0.01" />
              </div>
              <div>
                <Label htmlFor="purchasedate">Purchase Date</Label>
                <Input id="purchasedate" name="purchasedate" value={form.purchasedate ?? ""} onChange={onChange} type="date" />
              </div>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Identifiers</h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="assettag">Asset Tag *</Label>
                <Input
                  id="assettag"
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
                  className={assettagTaken ? "border-red-500" : ""}
                  required
                />
                {assettagTaken && <p className="text-sm text-red-500 mt-1">Asset tag already exists</p>}
              </div>
              <div>
                <Label htmlFor="serialnumber">Serial Number *</Label>
                <Input
                  id="serialnumber"
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
                  className={serialTaken ? "border-red-500" : ""}
                  required
                />
                {serialTaken && <p className="text-sm text-red-500 mt-1">Serial number already exists</p>}
              </div>
            </div>
          </section>
        </div>

        {error && <p className="text-red-500 text-sm" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => {
            if (!isDirty || confirm("Discard unsaved changes?")) router.back();
          }}>Cancel</Button>
          <Button variant="default" type="submit" disabled={saving || assettagTaken || serialTaken}>{saving ? "Saving..." : "Save"}</Button>
        </div>
      </form>
    </div>
  );
}
