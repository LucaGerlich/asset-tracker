"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Undo2, Loader2 } from "lucide-react";

interface ReturnItemButtonProps {
  /** If present, updates the existing ItemRequest to "returned" status */
  requestId?: string;
  /** Required when no requestId — the entity ID to unassign via self-return */
  entityId?: string;
  entityName: string;
  entityType: string;
}

export default function ReturnItemButton({
  requestId: _requestId,
  entityId,
  entityName,
  entityType,
}: ReturnItemButtonProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleReturn = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId: entityId || undefined,
          notes: notes || "Return request",
          status: "return_pending",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Return failed");
      }
      toast.success("Return requested", {
        description: "An admin will collect the item and confirm the return",
      });
      setOpen(false);
      // Reload to reflect the change
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Return failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Undo2 className="mr-2 h-4 w-4" />
        Return{" "}
        {entityType === "licence"
          ? "Licence"
          : entityType.charAt(0).toUpperCase() + entityType.slice(1)}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Return</DialogTitle>
            <DialogDescription>
              Submit a return request for{" "}
              <span className="font-medium">{entityName}</span>. An admin will
              collect the item and confirm the return.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="return-notes">Notes (optional)</Label>
            <Textarea
              id="return-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about the condition or reason for return..."
              rows={3}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReturn} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
