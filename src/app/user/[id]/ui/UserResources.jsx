"use client";
import React, { useMemo, useState } from "react";
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem } from "@heroui/react";
import { Toaster, toast } from "sonner";
import { formatDateISO } from "@/utils/utils";

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
        <Button variant="flat" isLoading={isRefreshing} onPress={() => refreshData(false)}>
          Refresh
        </Button>
      </div>
      <section className="col-span-1 rounded-lg border border-default-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground-600">Accessories</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="flat" onPress={() => setAssignAccOpen(true)}>Assign</Button>
          </div>
        </div>
        {accList.length === 0 ? (
          <p className="text-sm text-foreground-500">No accessories assigned.</p>
        ) : (
          <ul className="text-sm">
            {accList.map((acc) => (
              <li key={acc.accessorieid} className="flex items-center justify-between py-1 border-b border-default-200 last:border-0">
                <span>
                  {acc.accessoriename} <span className="text-foreground-500">({acc.accessorietag})</span>
                </span>
                <Button size="sm" variant="light" color="danger" onPress={() => unassignAcc(acc.accessorieid)}>Unassign</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="col-span-1 rounded-lg border border-default-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground-600">Licences</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="flat" onPress={() => setAssignLicOpen(true)}>Assign</Button>
          </div>
        </div>
        {licList.length === 0 ? (
          <p className="text-sm text-foreground-500">No licences assigned.</p>
        ) : (
          <ul className="text-sm">
            {licList.map((lic) => (
              <li key={lic.licenceid} className="flex items-center justify-between py-1 border-b border-default-200 last:border-0">
                <span>
                  {lic.licencekey || lic.licenceid}
                  {lic.expirationdate ? (
                    <span className="text-foreground-500"> • Expires {formatDateISO(lic.expirationdate)}</span>
                  ) : null}
                </span>
                <Button size="sm" variant="light" color="danger" onPress={() => unassignLic(lic.licenceid)}>Unassign</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal isOpen={assignAccOpen} onOpenChange={setAssignAccOpen} backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Assign Accessory</ModalHeader>
              <ModalBody>
                <Select
                  items={availableAccessories}
                  placeholder="Select an accessory"
                  aria-label="Select an accessory"
                  selectedKeys={new Set(selectedAcc ? [selectedAcc] : [])}
                  onSelectionChange={(keys) => setSelectedAcc(Array.from(keys)[0])}
                >
                  {(a) => (
                    <SelectItem key={a.accessorieid}>{a.accessoriename} ({a.accessorietag})</SelectItem>
                  )}
                </Select>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>Cancel</Button>
                <Button color="primary" isDisabled={!selectedAcc} onPress={assignAcc}>Assign</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={assignLicOpen} onOpenChange={setAssignLicOpen} backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Assign Licence</ModalHeader>
              <ModalBody>
                <Select
                  items={availableLicences}
                  placeholder="Select a licence"
                  aria-label="Select a licence"
                  selectedKeys={new Set(selectedLic ? [selectedLic] : [])}
                  onSelectionChange={(keys) => setSelectedLic(Array.from(keys)[0])}
                >
                  {(l) => (
                    <SelectItem key={l.licenceid}>{l.licencekey || l.licenceid}</SelectItem>
                  )}
                </Select>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>Cancel</Button>
                <Button color="primary" isDisabled={!selectedLic} onPress={assignLic}>Assign</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
