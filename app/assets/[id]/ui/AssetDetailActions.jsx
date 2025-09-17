"use client";
import React, { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { QRCodeCanvas } from "qrcode.react";
import { Toaster, toast } from "sonner";

export default function AssetDetailActions({ asset, users, userAssets, onAssigned }) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const qrRef = useRef(null);

  const assigned = userAssets.find((ua) => ua.assetid === asset.assetid);
  const assignedUser = assigned ? users.find((u) => u.userid === assigned.userid) : null;

  const handleAssign = useCallback(async () => {
    if (!selectedUser) return;
    try {
      const res = await fetch("/api/userAssets/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: asset.assetid, userId: selectedUser }),
      });
      if (!res.ok) throw new Error("Failed to assign user");
      toast.success("Assigned", { description: asset.assettag });
      setAssignOpen(false);
      onAssigned?.(selectedUser);
    } catch (e) {
      toast.error("Assign failed", { description: e.message });
    }
  }, [asset, selectedUser, onAssigned]);

  const handleDownload = useCallback(() => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `QRCode_${asset.assettag}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [asset]);

  return (
    <div className="flex gap-2">
      <Toaster position="bottom-right" />
      <Button variant="light" onClick={() => setAssignOpen(true)} disabled={!asset.requestable}>Assign User</Button>
      <Button variant="light" onClick={() => setQrOpen(true)}>Show QR Code</Button>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Assign User {assignedUser ? `(current: ${assignedUser.firstname} ${assignedUser.lastname})` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Select
              value={selectedUser || (assignedUser ? assignedUser.userid : "")}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <option value="">Select a user</option>
              {users.map((u) => (
                <SelectItem key={u.userid} value={u.userid}>
                  {u.firstname} {u.lastname}
                </SelectItem>
              ))}
            </Select>
          </div>
          <DialogFooter>
            <Button variant="light" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button disabled={!selectedUser} onClick={handleAssign}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR-Code for {asset.assettag}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-4" ref={qrRef}>
            <QRCodeCanvas value={`${typeof window !== "undefined" ? window.location.origin : ""}/assets/${asset.assetid}`} size={256} />
          </div>
          <DialogFooter>
            <Button variant="light" onClick={() => setQrOpen(false)}>Close</Button>
            <Button onClick={handleDownload}>Download</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
