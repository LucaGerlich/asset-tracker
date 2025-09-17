"use client";
import React from "react";
import { DataTable } from "@/components/ui/data-table";
import { createColumnHelper } from "@tanstack/react-table";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectItem } from "@/components/ui/select";
import { QRCodeCanvas } from "qrcode.react";

export default function AssetsDataTable({
  data,
  locations,
  status,
  user,
  manufacturers,
  models,
  categories,
  columns: _cols,
  selectOptions,
  userAssets,
  statuses,
}) {
  const [rows, setRows] = React.useState(data);
  const [selected, setSelected] = React.useState(null);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [qrOpen, setQrOpen] = React.useState(false);
  const [selectedUserId, setSelectedUserId] = React.useState("");

  const statusById = React.useMemo(() => new Map(status.map((s) => [s.statustypeid, s.statustypename])), [status]);
  const manuById = React.useMemo(() => new Map(manufacturers.map((m) => [m.manufacturerid, m.manufacturername])), [manufacturers]);
  const modelById = React.useMemo(() => new Map(models.map((m) => [m.modelid, m.modelname])), [models]);
  const catById = React.useMemo(() => new Map(categories.map((c) => [c.assetcategorytypeid, c.assetcategorytypename])), [categories]);
  const locById = React.useMemo(() => new Map(locations.map((l) => [l.locationid, l.locationname])), [locations]);

  const onDelete = async (assetId) => {
    try {
      const res = await fetch("/api/asset/deleteAsset/", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId }),
      });
      if (!res.ok) throw new Error("Delete failed");
      setRows((r) => r.filter((a) => a.assetid !== assetId));
      toast.success("Asset deleted", { description: assetId });
    } catch (e) {
      toast.error("Delete failed", { description: e.message });
    }
  };

  const onAssign = async () => {
    try {
      const res = await fetch("/api/userAssets/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: selected.assetid, userId: selectedUserId }),
      });
      if (!res.ok) throw new Error("Failed to assign user");
      const activeId = [...statusById.entries()].find(([k, v]) => (v || "").toLowerCase() === "active")?.[0];
      if (activeId) {
        setRows((rs) => rs.map((r) => (r.assetid === selected.assetid ? { ...r, statustypeid: activeId } : r)));
      }
      setAssignOpen(false);
      toast.success("Assigned", { description: selected.assettag });
    } catch (e) {
      toast.error("Assign failed", { description: e.message });
    }
  };

  const col = createColumnHelper();
  const toOptions = React.useCallback((values) => {
    const unique = [];
    const seen = new Set();
    values.forEach((value) => {
      if (!value) return;
      if (seen.has(value)) return;
      seen.add(value);
      unique.push({ value, label: value });
    });
    return unique;
  }, []);
  const columns = [
    col.accessor((r) => r.assetname, { id: "assetname", header: "Name" }),
    col.accessor((r) => r.assettag, { id: "assettag", header: "Tag" }),
    col.accessor((r) => r.serialnumber, { id: "serialnumber", header: "Serial" }),
    col.accessor((r) => manuById.get(r.manufacturerid) ?? "-", { id: "manufacturer", header: "Manufacturer" }),
    col.accessor((r) => modelById.get(r.modelid) ?? "-", { id: "model", header: "Model" }),
    col.accessor((r) => statusById.get(r.statustypeid) ?? "-", { id: "status", header: "Status" }),
    col.accessor((r) => catById.get(r.assetcategorytypeid) ?? "-", { id: "category", header: "Category" }),
    col.accessor((r) => locById.get(r.locationid) ?? "-", { id: "location", header: "Location" }),
    col.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const a = row.original;
        return (
          
          <div className="flex justify-center items-center gap-2">
            <Link href={`/assets/${a.assetid}`}>View</Link>
            <Link href={`/assets/${a.assetid}/edit`}>Edit</Link>
            <DropdownMenu align="start">
            <DropdownMenuTrigger asChild>
              <Button variant="light" size="sm">More</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setSelected(a); setAssignOpen(true); setSelectedUserId(""); }}>Assign User</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSelected(a); setQrOpen(true); }}>Show QR Code</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSelected(a); setStatusOpen(true); setStatusId(""); }}>Assign Status</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem style={{ color: "red" }} onClick={() => onDelete(a.assetid)}>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        
        );
      },
    }),
  ];

  const filters = React.useMemo(() => (
    [
      {
        columnId: "status",
        title: "Status",
        options: toOptions(status.map((s) => s.statustypename ?? "")),
      },
      {
        columnId: "category",
        title: "Category",
        options: toOptions(categories.map((c) => c.assetcategorytypename ?? "")),
      },
      {
        columnId: "location",
        title: "Location",
        options: toOptions(locations.map((l) => l.locationname ?? "")),
      },
    ].filter((f) => f.options.length)
  ), [status, categories, locations, toOptions]);

  const content = (
    <>
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User {selected ? `to ${selected.assetname}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
              <option value="">Select a user</option>
              {user.map((u) => (
                <SelectItem key={u.userid} value={u.userid}>{u.firstname} {u.lastname}</SelectItem>
              ))}
            </Select>
          </div>
          <DialogFooter>
            <Button variant="light" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button disabled={!selectedUserId} onClick={onAssign}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR-Code {selected ? `for ${selected.assettag}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-4">
            {selected && (
              <QRCodeCanvas value={`${typeof window !== "undefined" ? window.location.origin : ""}/assets/${selected.assetid}`} size={256} />
            )}
          </div>
          <DialogFooter>
            <Button variant="light" onClick={() => setQrOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return (
    <div className="space-y-3">
      <DataTable columns={columns} data={rows} searchableColumn="assetname" filters={filters} />
      {content}
    </div>
  );
}
