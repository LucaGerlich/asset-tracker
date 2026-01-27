"use client";
import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

export default function AssetCreateForm({ categories, locations, manufacturers, models, statuses, suppliers, users }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [createdAsset, setCreatedAsset] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [assettagTaken, setAssettagTaken] = useState(false);
  const [serialTaken, setSerialTaken] = useState(false);
  const [form, setForm] = useState({
    assetname: "",
    assettag: "",
    serialnumber: "",
    modelid: "",
    specs: "",
    notes: "",
    purchaseprice: "",
    purchasedate: "",
    mobile: false,
    requestable: false,
    assetcategorytypeid: "",
    statustypeid: "",
    supplierid: "",
    locationid: "",
    manufacturerid: "",
  });

  // Preselect default status "Available" if present
  useEffect(() => {
    if (!form.statustypeid && Array.isArray(statuses) && statuses.length) {
      const available = statuses.find((s) => s.statustypename?.toLowerCase() === "available");
      if (available) {
        setForm((f) => ({ ...f, statustypeid: available.statustypeid }));
      }
    }
  }, [statuses]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSelectChange = (name) => (value) => {
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e, assignAfter = false) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        ...form,
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
      };
      const res = await fetch("/api/asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create asset");
      }
      const created = await res.json();
      toast.success("Asset created", { description: created.assettag });
      if (assignAfter) {
        setCreatedAsset(created);
        setAssignModalOpen(true);
      } else {
        router.push(`/assets/${created.assetid}`);
      }
    } catch (err) {
      setError(err.message);
      toast.error("Create failed", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = useCallback(() => {
    setForm({
      assetname: "",
      assettag: "",
      serialnumber: "",
      modelid: "",
      specs: "",
      notes: "",
      purchaseprice: "",
      purchasedate: "",
      mobile: false,
      requestable: false,
      assetcategorytypeid: "",
      statustypeid: "",
      supplierid: "",
      locationid: "",
      manufacturerid: "",
    });
  }, []);

  return (
    <div className="max-w-5xl">
      <Toaster position="bottom-right" />
      <form onSubmit={(e) => onSubmit(e, false)} className="flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold">Create New Asset</h1>
            <p className="text-sm text-foreground-500 mt-1">Fill out details below</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => router.back()}>Cancel</Button>
            <Button variant="default" className="w-full sm:w-auto" type="submit" disabled={submitting || assettagTaken || serialTaken}>{submitting ? "Creating..." : "Create"}</Button>
            <Button variant="default" className="w-full sm:w-auto shadow-lg" disabled={submitting || assettagTaken || serialTaken} type="button" onClick={() => onSubmit({ preventDefault: () => {} }, true)}>{submitting ? "Creating..." : "Create & Assign"}</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
                <Textarea id="specs" name="specs" value={form.specs} onChange={onChange} rows={2} />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" value={form.notes} onChange={onChange} rows={2} />
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
                <Input id="purchaseprice" name="purchaseprice" value={form.purchaseprice} onChange={onChange} type="number" step="0.01" />
              </div>
              <div>
                <Label htmlFor="purchasedate">Purchase Date</Label>
                <Input id="purchasedate" name="purchasedate" value={form.purchasedate} onChange={onChange} type="date" />
              </div>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
                    if (!form.assettag) return;
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
                    if (!form.serialnumber) return;
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
        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={resetForm}>Reset</Button>
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => router.back()}>Cancel</Button>
          <Button variant="default" className="w-full sm:w-auto" type="submit" disabled={submitting || assettagTaken || serialTaken}>{submitting ? "Creating..." : "Create"}</Button>
          <Button variant="default" className="w-full sm:w-auto shadow-lg" disabled={submitting || assettagTaken || serialTaken} type="button" onClick={() => onSubmit({ preventDefault: () => {} }, true)}>{submitting ? "Creating..." : "Create & Assign"}</Button>
        </div>
      </form>

      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User to {createdAsset?.assetname}</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="userid">Select a user</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="userid">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.userid} value={u.userid}>
                    {u.firstname} {u.lastname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAssignModalOpen(false);
              router.push(`/assets/${createdAsset?.assetid}`);
            }}>Skip</Button>
            <Button variant="default" disabled={!selectedUserId} onClick={async () => {
              try {
                const res = await fetch(`/api/userAssets/assign`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ assetId: createdAsset.assetid, userId: selectedUserId }),
                });
                if (!res.ok) throw new Error("Failed to assign user");
                toast.success("User assigned", { description: createdAsset.assettag });
              } catch (e) {
                toast.error("Assign failed", { description: e.message });
              } finally {
                setAssignModalOpen(false);
                router.push(`/assets/${createdAsset?.assetid}`);
              }
            }}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
