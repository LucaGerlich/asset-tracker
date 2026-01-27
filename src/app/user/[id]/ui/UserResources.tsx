"use client";
import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster, toast } from "sonner";

export default function UserResources({ user, accessories, licences, allAccessories, allLicences }) {
  const [accList, setAccList] = useState(accessories);
  const [licList, setLicList] = useState(licences);
  const [assignAccOpen, setAssignAccOpen] = useState(false);
  const [assignLicOpen, setAssignLicOpen] = useState(false);
  const [selectedAcc, setSelectedAcc] = useState(null);
  const [selectedLic, setSelectedLic] = useState(null);

  const availableAccessories = useMemo(() => {
    const assignedIds = new Set(accList.map((a) => a.accessorieid));
    return allAccessories.filter((a) => !assignedIds.has(a.accessorieid));
  }, [allAccessories, accList]);

  const availableLicences = useMemo(() => {
    return allLicences.filter((l) => !l.licenceduserid);
  }, [allLicences]);

  const unassignAcc = async (accessorieId) => {
    try {
      const res = await fetch("/api/userAccessoires/unassign", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.userid, accessorieId }),
      });
      if (!res.ok) throw new Error("Failed to unassign accessory");
      setAccList((prev) => prev.filter((a) => a.accessorieid !== accessorieId));
      toast.success("Accessory unassigned");
    } catch (e) {
      toast.error("Unassign failed", { description: e.message });
    }
  };

  const assignAcc = async () => {
    if (!selectedAcc) return;
    try {
      const res = await fetch("/api/userAccessoires/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.userid, accessorieId: selectedAcc }),
      });
      if (!res.ok) throw new Error("Failed to assign accessory");
      const added = availableAccessories.find((a) => a.accessorieid === selectedAcc);
      if (added) setAccList((prev) => [...prev, added]);
      setSelectedAcc(null);
      setAssignAccOpen(false);
      toast.success("Accessory assigned");
    } catch (e) {
      toast.error("Assign failed", { description: e.message });
    }
  };

  const unassignLic = async (licenceId) => {
    try {
      const res = await fetch("/api/licence/unassign", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenceId }),
      });
      if (!res.ok) throw new Error("Failed to unassign licence");
      setLicList((prev) => prev.filter((l) => l.licenceid !== licenceId));
      toast.success("Licence unassigned");
    } catch (e) {
      toast.error("Unassign failed", { description: e.message });
    }
  };

  const assignLic = async () => {
    if (!selectedLic) return;
    try {
      const res = await fetch("/api/licence/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenceId: selectedLic, userId: user.userid }),
      });
      if (!res.ok) throw new Error("Failed to assign licence");
      const added = availableLicences.find((l) => l.licenceid === selectedLic);
      if (added) setLicList((prev) => [...prev, { ...added, licenceduserid: user.userid }]);
      setSelectedLic(null);
      setAssignLicOpen(false);
      toast.success("Licence assigned");
    } catch (e) {
      toast.error("Assign failed", { description: e.message });
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshData = async (auto = false) => {
    try {
      setIsRefreshing(true);
      const [accRowsRes, allAccRes, licRes] = await Promise.all([
        fetch(`/api/userAccessoires?userId=${encodeURIComponent(user.userid)}`),
        fetch(`/api/accessories`),
        fetch(`/api/licence`),
      ]);
      if (!accRowsRes.ok || !allAccRes.ok || !licRes.ok) throw new Error("Refresh failed");
      const [accRows, allAcc, allLic] = await Promise.all([
        accRowsRes.json(),
        allAccRes.json(),
        licRes.json(),
      ]);
      const assignedAccIds = new Set(accRows.filter((r) => r.userid === user.userid).map((r) => r.accessorieid));
      const newAccList = allAcc.filter((a) => assignedAccIds.has(a.accessorieid));
      const newLicList = (allLic || []).filter((l) => l.licenceduserid === user.userid);
      setAccList(newAccList);
      setLicList(newLicList);
      if (auto) toast("User resources refreshed");
    } catch (e) {
      // Silent fail
    } finally {
      setIsRefreshing(false);
    }
  };

  React.useEffect(() => {
    const onFocus = () => refreshData(true);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshData(true);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      <Toaster position="bottom-right" />
      <div className="md:col-span-2 flex justify-end -mb-2">
        <Button variant="outline" disabled={isRefreshing} onClick={() => refreshData(false)}>
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>
      <section className="col-span-1 rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Accessories</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setAssignAccOpen(true)}>Assign</Button>
          </div>
        </div>
        {accList.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accessories assigned.</p>
        ) : (
          <ul className="text-sm">
            {accList.map((acc) => (
              <li key={acc.accessorieid} className="flex items-center justify-between py-1 border-b last:border-0">
                <span>
                  {acc.accessoriename} <span className="text-muted-foreground">({acc.accessorietag})</span>
                </span>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => unassignAcc(acc.accessorieid)}>Unassign</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="col-span-1 rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Licences</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setAssignLicOpen(true)}>Assign</Button>
          </div>
        </div>
        {licList.length === 0 ? (
          <p className="text-sm text-muted-foreground">No licences assigned.</p>
        ) : (
          <ul className="text-sm">
            {licList.map((lic) => (
              <li key={lic.licenceid} className="flex items-center justify-between py-1 border-b last:border-0">
                <span>
                  {lic.licencekey || lic.licenceid}
                  {lic.expirationdate ? (
                    <span className="text-muted-foreground"> • Expires {new Date(lic.expirationdate).toLocaleDateString()}</span>
                  ) : null}
                </span>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => unassignLic(lic.licenceid)}>Unassign</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={assignAccOpen} onOpenChange={setAssignAccOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Accessory</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedAcc || ""} onValueChange={setSelectedAcc}>
              <SelectTrigger>
                <SelectValue placeholder="Select an accessory" />
              </SelectTrigger>
              <SelectContent>
                {availableAccessories.map((a) => (
                  <SelectItem key={a.accessorieid} value={a.accessorieid}>{a.accessoriename} ({a.accessorietag})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignAccOpen(false)}>Cancel</Button>
            <Button disabled={!selectedAcc} onClick={assignAcc}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignLicOpen} onOpenChange={setAssignLicOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Licence</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedLic || ""} onValueChange={setSelectedLic}>
              <SelectTrigger>
                <SelectValue placeholder="Select a licence" />
              </SelectTrigger>
              <SelectContent>
                {availableLicences.map((l) => (
                  <SelectItem key={l.licenceid} value={l.licenceid}>{l.licencekey || l.licenceid}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignLicOpen(false)}>Cancel</Button>
            <Button disabled={!selectedLic} onClick={assignLic}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
