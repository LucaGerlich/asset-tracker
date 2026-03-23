"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowRight, Repeat } from "lucide-react";

interface AssetTransfersProps {
  assetId: string;
  currentUserId?: string;
  currentLocationId?: string;
  currentOrgId?: string;
}

interface Transfer {
  id: string;
  assetId: string;
  transferType: string;
  fromUserId: string | null;
  toUserId: string | null;
  fromLocationId: string | null;
  toLocationId: string | null;
  fromOrgId: string | null;
  toOrgId: string | null;
  reason: string | null;
  transferredBy: string;
  transferredAt: string;
}

interface UserOption {
  userid: string;
  firstname: string;
  lastname: string;
  username: string | null;
  email: string | null;
}

interface LocationOption {
  locationid: string;
  locationname: string | null;
}

interface OrgOption {
  id: string;
  name: string;
}

const TRANSFER_TYPE_LABELS: Record<string, string> = {
  user: "User",
  location: "Location",
  organization: "Organization",
};

const TRANSFER_TYPE_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline"
> = {
  user: "default",
  location: "secondary",
  organization: "outline",
};

export default function AssetTransfers({
  assetId,
  currentUserId,
  currentLocationId,
  currentOrgId,
}: AssetTransfersProps) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [transferType, setTransferType] = useState<string>("");
  const [targetId, setTargetId] = useState<string>("");
  const [reason, setReason] = useState("");

  // Options for selectors
  const [users, setUsers] = useState<UserOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Lookup maps for display names
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [locationMap, setLocationMap] = useState<Record<string, string>>({});
  const [orgMap, setOrgMap] = useState<Record<string, string>>({});

  const fetchTransfers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/asset/transfers?assetId=${assetId}`);
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to fetch transfers");
        return;
      }
      const data: Transfer[] = await res.json();
      setTransfers(data);
    } catch {
      toast.error("Failed to connect to the server");
    } finally {
      setIsLoading(false);
    }
  }, [assetId]);

  const fetchLookupData = useCallback(async () => {
    try {
      const [usersRes, locationsRes, orgsRes] = await Promise.all([
        fetch("/api/user"),
        fetch("/api/location"),
        fetch("/api/organizations"),
      ]);

      if (usersRes.ok) {
        const usersData: UserOption[] = await usersRes.json();
        setUsers(usersData);
        const uMap: Record<string, string> = {};
        for (const u of usersData) {
          uMap[u.userid] = `${u.firstname} ${u.lastname}`;
        }
        setUserMap(uMap);
      }

      if (locationsRes.ok) {
        const locData: LocationOption[] = await locationsRes.json();
        setLocations(locData);
        const lMap: Record<string, string> = {};
        for (const l of locData) {
          lMap[l.locationid] = l.locationname || "Unnamed Location";
        }
        setLocationMap(lMap);
      }

      if (orgsRes.ok) {
        const orgData: OrgOption[] = await orgsRes.json();
        setOrgs(orgData);
        const oMap: Record<string, string> = {};
        for (const o of orgData) {
          oMap[o.id] = o.name;
        }
        setOrgMap(oMap);
      }
    } catch {
      // Silently fail lookup data - the component still works
    }
  }, []);

  useEffect(() => {
    fetchTransfers();
    fetchLookupData();
  }, [fetchTransfers, fetchLookupData]);

  // Load target options when transfer type changes in the dialog
  const fetchTargetOptions = useCallback(async (type: string) => {
    setLoadingOptions(true);
    try {
      if (type === "user") {
        const res = await fetch("/api/user");
        if (res.ok) setUsers(await res.json());
      } else if (type === "location") {
        const res = await fetch("/api/location");
        if (res.ok) setLocations(await res.json());
      } else if (type === "organization") {
        const res = await fetch("/api/organizations");
        if (res.ok) setOrgs(await res.json());
      }
    } catch {
      toast.error("Failed to load options");
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  const handleTypeChange = (type: string) => {
    setTransferType(type);
    setTargetId("");
    fetchTargetOptions(type);
  };

  const handleSubmit = async () => {
    if (!transferType || !targetId) {
      toast.error("Please select a transfer type and target");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, string | undefined> = {
        assetId,
        transferType,
        reason: reason || undefined,
      };

      if (transferType === "user") payload.toUserId = targetId;
      else if (transferType === "location") payload.toLocationId = targetId;
      else if (transferType === "organization") payload.toOrgId = targetId;

      const res = await fetch("/api/asset/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to create transfer");
        return;
      }

      toast.success("Asset transferred successfully");
      setDialogOpen(false);
      setTransferType("");
      setTargetId("");
      setReason("");
      fetchTransfers();
    } catch {
      toast.error("Failed to connect to the server");
    } finally {
      setSubmitting(false);
    }
  };

  const getFromLabel = (t: Transfer): string => {
    if (t.transferType === "user") {
      return t.fromUserId
        ? userMap[t.fromUserId] || t.fromUserId
        : "Unassigned";
    }
    if (t.transferType === "location") {
      return t.fromLocationId
        ? locationMap[t.fromLocationId] || t.fromLocationId
        : "No Location";
    }
    if (t.transferType === "organization") {
      return t.fromOrgId
        ? orgMap[t.fromOrgId] || t.fromOrgId
        : "No Organization";
    }
    return "-";
  };

  const getToLabel = (t: Transfer): string => {
    if (t.transferType === "user") {
      return t.toUserId ? userMap[t.toUserId] || t.toUserId : "Unassigned";
    }
    if (t.transferType === "location") {
      return t.toLocationId
        ? locationMap[t.toLocationId] || t.toLocationId
        : "No Location";
    }
    if (t.transferType === "organization") {
      return t.toOrgId ? orgMap[t.toOrgId] || t.toOrgId : "No Organization";
    }
    return "-";
  };

  const renderTargetSelector = () => {
    if (!transferType) return null;

    if (loadingOptions) {
      return (
        <p className="text-muted-foreground text-sm">Loading options...</p>
      );
    }

    if (transferType === "user") {
      return (
        <div className="space-y-2">
          <Label htmlFor="target-user">Target User</Label>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger id="target-user">
              <SelectValue placeholder="Select a user" />
            </SelectTrigger>
            <SelectContent>
              {users
                .filter((u) => u.userid !== currentUserId)
                .map((u) => (
                  <SelectItem key={u.userid} value={u.userid}>
                    {u.firstname} {u.lastname}
                    {u.email ? ` (${u.email})` : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (transferType === "location") {
      return (
        <div className="space-y-2">
          <Label htmlFor="target-location">Target Location</Label>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger id="target-location">
              <SelectValue placeholder="Select a location" />
            </SelectTrigger>
            <SelectContent>
              {locations
                .filter((l) => l.locationid !== currentLocationId)
                .map((l) => (
                  <SelectItem key={l.locationid} value={l.locationid}>
                    {l.locationname || "Unnamed Location"}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (transferType === "organization") {
      return (
        <div className="space-y-2">
          <Label htmlFor="target-org">Target Organization</Label>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger id="target-org">
              <SelectValue placeholder="Select an organization" />
            </SelectTrigger>
            <SelectContent>
              {orgs
                .filter((o) => o.id !== currentOrgId)
                .map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Repeat className="h-5 w-5" />
          Transfer History
        </h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Repeat className="mr-2 h-4 w-4" />
              Transfer Asset
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transfer Asset</DialogTitle>
              <DialogDescription>
                Transfer this asset to a different user, location, or
                organization.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="transfer-type">Transfer Type</Label>
                <Select value={transferType} onValueChange={handleTypeChange}>
                  <SelectTrigger id="transfer-type">
                    <SelectValue placeholder="Select transfer type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="location">Location</SelectItem>
                    <SelectItem value="organization">Organization</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {renderTargetSelector()}

              <div className="space-y-2">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Input
                  id="reason"
                  placeholder="Reason for transfer"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !transferType || !targetId}
              >
                {submitting ? "Transferring..." : "Confirm Transfer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading transfers...</p>
      ) : transfers.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No transfers recorded for this asset.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead></TableHead>
                <TableHead>To</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Transferred By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Badge
                      variant={
                        TRANSFER_TYPE_VARIANTS[t.transferType] || "default"
                      }
                    >
                      {TRANSFER_TYPE_LABELS[t.transferType] || t.transferType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {getFromLabel(t)}
                  </TableCell>
                  <TableCell>
                    <ArrowRight className="text-muted-foreground h-4 w-4" />
                  </TableCell>
                  <TableCell>{getToLabel(t)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.reason || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {new Date(t.transferredAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {userMap[t.transferredBy] || t.transferredBy}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
