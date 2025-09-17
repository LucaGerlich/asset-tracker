"use client";
import React, { useState, useCallback, useEffect } from "react";
import {
  Button,
  Input,
  Checkbox,
  Card,
  CardBody,
  CardHeader,
  Select,
  SelectItem,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@nextui-org/react";
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

  const onSelectChange = (name) => (keys) => {
    const value = Array.from(keys)[0] || "";
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
      <form onSubmit={(e) => onSubmit(e, false)} className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Create New Asset</h1>
            <p className="text-sm text-foreground-500 mt-1">Fill out details below</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="light" onPress={() => router.back()}>Cancel</Button>
            <Button color="primary" type="submit" isLoading={submitting} isDisabled={assettagTaken || serialTaken}>Create</Button>
            <Button color="primary" variant="shadow" isLoading={submitting} isDisabled={assettagTaken || serialTaken} type="button" onPress={() => onSubmit({ preventDefault: () => {} }, true)}>Create & Assign</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Summary</h2>
            <div className="grid grid-cols-1 gap-3">
              <Input label="Asset Name" name="assetname" value={form.assetname} onChange={onChange} isRequired />
              <Select label="Category" selectedKeys={new Set(form.assetcategorytypeid ? [form.assetcategorytypeid] : [])} onSelectionChange={onSelectChange("assetcategorytypeid")} placeholder="Select category">
                {categories.map((c) => (
                  <SelectItem key={c.assetcategorytypeid}>{c.assetcategorytypename}</SelectItem>
                ))}
              </Select>
              <Select label="Status" selectedKeys={new Set(form.statustypeid ? [form.statustypeid] : [])} onSelectionChange={onSelectChange("statustypeid")} placeholder="Select status">
                {statuses.map((s) => (
                  <SelectItem key={s.statustypeid}>{s.statustypename}</SelectItem>
                ))}
              </Select>
              <Select label="Location" selectedKeys={new Set(form.locationid ? [form.locationid] : [])} onSelectionChange={onSelectChange("locationid")} placeholder="Select location">
                {locations.map((l) => (
                  <SelectItem key={l.locationid}>{l.locationname}</SelectItem>
                ))}
              </Select>
              <div className="flex gap-6">
                <Checkbox isSelected={form.requestable} onValueChange={(v) => setForm((f) => ({ ...f, requestable: v }))}>Requestable</Checkbox>
                <Checkbox isSelected={form.mobile} onValueChange={(v) => setForm((f) => ({ ...f, mobile: v }))}>Mobile</Checkbox>
              </div>
            </div>
          </section>

          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Specifications</h2>
            <div className="grid grid-cols-1 gap-3">
              <Select label="Manufacturer" selectedKeys={new Set(form.manufacturerid ? [form.manufacturerid] : [])} onSelectionChange={onSelectChange("manufacturerid")} placeholder="Select manufacturer">
                {manufacturers.map((m) => (
                  <SelectItem key={m.manufacturerid}>{m.manufacturername}</SelectItem>
                ))}
              </Select>
              <Select label="Model" selectedKeys={new Set(form.modelid ? [form.modelid] : [])} onSelectionChange={onSelectChange("modelid")} placeholder="Select model">
                {models.map((m) => (
                  <SelectItem key={m.modelid}>{m.modelname}</SelectItem>
                ))}
              </Select>
              <Textarea label="Specs" name="specs" value={form.specs} onChange={onChange} minRows={2} />
              <Textarea label="Notes" name="notes" value={form.notes} onChange={onChange} minRows={2} />
            </div>
          </section>

          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Procurement</h2>
            <div className="grid grid-cols-1 gap-3">
              <Select label="Supplier" selectedKeys={new Set(form.supplierid ? [form.supplierid] : [])} onSelectionChange={onSelectChange("supplierid")} placeholder="Select supplier">
                {suppliers.map((s) => (
                  <SelectItem key={s.supplierid}>{s.suppliername}</SelectItem>
                ))}
              </Select>
              <Input label="Purchase Price" name="purchaseprice" value={form.purchaseprice} onChange={onChange} type="number" step="0.01" />
              <Input label="Purchase Date" name="purchasedate" value={form.purchasedate} onChange={onChange} type="date" />
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Identifiers</h2>
            <div className="grid grid-cols-1 gap-3">
              <Input
                label="Asset Tag"
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
                isInvalid={assettagTaken}
                errorMessage={assettagTaken ? "Asset tag already exists" : undefined}
                isRequired
              />
              <Input
                label="Serial Number"
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
                isInvalid={serialTaken}
                errorMessage={serialTaken ? "Serial number already exists" : undefined}
                isRequired
              />
            </div>
          </section>
        </div>

        {error && <p className="text-red-500 text-sm" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="light" onPress={resetForm}>Reset</Button>
          <Button type="button" variant="light" onPress={() => router.back()}>Cancel</Button>
          <Button color="primary" type="submit" isLoading={submitting} isDisabled={assettagTaken || serialTaken}>Create</Button>
          <Button color="primary" variant="shadow" isLoading={submitting} isDisabled={assettagTaken || serialTaken} type="button" onPress={() => onSubmit({ preventDefault: () => {} }, true)}>Create & Assign</Button>
        </div>
      </form>

      <Modal isOpen={assignModalOpen} onOpenChange={setAssignModalOpen} backdrop="blur" isKeyboardDismissDisabled>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Assign User to {createdAsset?.assetname}</ModalHeader>
              <ModalBody>
                <Select
                  items={users}
                  placeholder="Select a user"
                  aria-label="Select a user"
                  selectedKeys={new Set(selectedUserId ? [selectedUserId] : [])}
                  onSelectionChange={(keys) => setSelectedUserId(Array.from(keys)[0])}
                >
                  {(u) => (
                    <SelectItem key={u.userid}>
                      {u.firstname} {u.lastname}
                    </SelectItem>
                  )}
                </Select>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={() => {
                  onClose();
                  router.push(`/assets/${createdAsset?.assetid}`);
                }}>Skip</Button>
                <Button color="primary" isDisabled={!selectedUserId} onPress={async () => {
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
                    onClose();
                    router.push(`/assets/${createdAsset?.assetid}`);
                  }
                }}>Assign</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
