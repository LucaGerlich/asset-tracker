"use client";
import React, { useState, useCallback, useRef } from "react";
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem } from "@nextui-org/react";
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
      <Button variant="flat" onPress={() => setAssignOpen(true)} isDisabled={!asset.requestable}>Assign User</Button>
      <Button variant="flat" onPress={() => setQrOpen(true)}>Show QR Code</Button>

      <Modal isOpen={assignOpen} onOpenChange={setAssignOpen} backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Assign User {assignedUser ? `(current: ${assignedUser.firstname} ${assignedUser.lastname})` : ""}</ModalHeader>
              <ModalBody>
                <Select
                  items={users}
                  placeholder="Select a user"
                  aria-label="Select a user"
                  selectedKeys={new Set(selectedUser ? [selectedUser] : assignedUser ? [assignedUser.userid] : [])}
                  onSelectionChange={(keys) => setSelectedUser(Array.from(keys)[0])}
                >
                  {(u) => (
                    <SelectItem key={u.userid}>{u.firstname} {u.lastname}</SelectItem>
                  )}
                </Select>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>Cancel</Button>
                <Button color="primary" isDisabled={!selectedUser} onPress={handleAssign}>Assign</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={qrOpen} onOpenChange={setQrOpen} backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>QR-Code for {asset.assettag}</ModalHeader>
              <ModalBody className="flex justify-center">
                <div ref={qrRef}>
                  <QRCodeCanvas value={`${typeof window !== "undefined" ? window.location.origin : ""}/assets/${asset.assetid}`} size={256} />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>Close</Button>
                <Button color="primary" onPress={handleDownload}>Download</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

