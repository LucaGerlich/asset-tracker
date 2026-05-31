"use client";
import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";

export default function AssetDetailActions({
  asset,
  users,
  userAssets,
  onAssigned,
}) {
  const router = useRouter();
  const [assignOpen, setAssignOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const qrRef = useRef(null);

  const assigned = userAssets.find((ua) => ua.assetid === asset.assetid);
  const assignedUser = assigned
    ? users.find((u) => u.userid === assigned.userid)
    : null;

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

  const handleDuplicate = useCallback(() => {
    const params = new URLSearchParams();
    if (asset.assetname) params.set("assetname", asset.assetname);
    if (asset.assetcategorytypeid)
      params.set("assetcategorytypeid", asset.assetcategorytypeid);
    if (asset.statustypeid) params.set("statustypeid", asset.statustypeid);
    if (asset.locationid) params.set("locationid", asset.locationid);
    if (asset.manufacturerid)
      params.set("manufacturerid", asset.manufacturerid);
    if (asset.modelid) params.set("modelid", asset.modelid);
    if (asset.supplierid) params.set("supplierid", asset.supplierid);
    if (asset.specs) params.set("specs", asset.specs);
    if (asset.purchaseprice != null)
      params.set("purchaseprice", String(asset.purchaseprice));
    if (asset.warrantyMonths != null)
      params.set("warrantyMonths", String(asset.warrantyMonths));
    params.set("mobile", String(Boolean(asset.mobile)));
    params.set("requestable", String(Boolean(asset.requestable)));
    router.push(`/assets/create?${params.toString()}`);
  }, [asset, router]);

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={() => setAssignOpen(true)}
        disabled={!asset.requestable}
      >
        Assign User
      </Button>
      <Button variant="outline" onClick={() => setQrOpen(true)}>
        Show QR Code
      </Button>
      <Button variant="outline" onClick={handleDuplicate}>
        <Copy className="mr-2 h-4 w-4" />
        Duplicate
      </Button>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Assign User{" "}
              {assignedUser
                ? `(current: ${assignedUser.firstname} ${assignedUser.lastname})`
                : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Select
              value={selectedUser || (assignedUser ? assignedUser.userid : "")}
              onValueChange={setSelectedUser}
            >
              <SelectTrigger>
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
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!selectedUser} onClick={handleAssign}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR-Code for {asset.assettag}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-4" ref={qrRef}>
            <QRCodeCanvas
              value={`${typeof window !== "undefined" ? window.location.origin : ""}/assets/${asset.assetid}`}
              size={256}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setQrOpen(false)}>
              Close
            </Button>
            <Button onClick={handleDownload}>Download</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
