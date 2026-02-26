"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface BulkCheckoutResult {
  success: Array<{ id: string; assetId: string }>;
  failed: Array<{ assetId: string; reason: string }>;
}

interface BulkCheckoutModalProps {
  assetIds: string[];
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkCheckoutModal({
  assetIds,
  open,
  onClose,
  onSuccess,
}: BulkCheckoutModalProps) {
  const [checkedOutToType, setCheckedOutToType] = useState<string>("user");
  const [targetId, setTargetId] = useState("");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<BulkCheckoutResult | null>(null);

  const handleSubmit = async () => {
    if (!targetId.trim()) {
      toast.error("Please enter a target ID");
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const payload: Record<string, unknown> = {
        assetIds,
        checkedOutToType,
        expectedReturn: expectedReturn || null,
        notes: notes || null,
      };

      if (checkedOutToType === "user") {
        payload.checkedOutTo = targetId;
      } else if (checkedOutToType === "location") {
        payload.checkedOutToLocationId = targetId;
      } else if (checkedOutToType === "asset") {
        payload.checkedOutToAssetId = targetId;
      }

      const res = await fetch("/api/asset/checkout/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Bulk checkout failed");
        return;
      }

      const data: BulkCheckoutResult = await res.json();
      setResult(data);

      const successCount = data.success.length;
      const failedCount = data.failed.length;

      if (failedCount === 0) {
        toast.success(`${successCount} asset(s) checked out successfully`);
      } else {
        toast.warning(
          `${successCount} succeeded, ${failedCount} failed`,
        );
      }

      onSuccess();
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCheckedOutToType("user");
    setTargetId("");
    setExpectedReturn("");
    setNotes("");
    setResult(null);
    onClose();
  };

  const targetLabel =
    checkedOutToType === "user"
      ? "User ID"
      : checkedOutToType === "location"
        ? "Location ID"
        : "Asset ID";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Checkout</DialogTitle>
          <DialogDescription>
            Check out {assetIds.length} selected asset(s) to a user, location,
            or asset.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="checkoutType">Checkout Type</Label>
              <Select
                value={checkedOutToType}
                onValueChange={setCheckedOutToType}
              >
                <SelectTrigger id="checkoutType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                  <SelectItem value="asset">Asset</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="targetId">{targetLabel}</Label>
              <Input
                id="targetId"
                placeholder={`Enter ${targetLabel.toLowerCase()}`}
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="expectedReturn">
                Expected Return Date (optional)
              </Label>
              <Input
                id="expectedReturn"
                type="date"
                value={expectedReturn}
                onChange={(e) => setExpectedReturn(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting
                  ? "Processing..."
                  : `Check Out ${assetIds.length} Asset(s)`}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm font-medium">
                {result.success.length} asset(s) checked out successfully
              </p>
              {result.failed.length > 0 && (
                <p className="text-sm text-destructive mt-1">
                  {result.failed.length} asset(s) failed
                </p>
              )}
            </div>

            {result.failed.length > 0 && (
              <div>
                <Label className="text-sm font-medium text-destructive">
                  Failed Assets
                </Label>
                <ul className="mt-1 space-y-1 text-sm">
                  {result.failed.map((f) => (
                    <li
                      key={f.assetId}
                      className="flex items-center justify-between rounded border px-3 py-1.5"
                    >
                      <span className="font-mono text-xs">{f.assetId}</span>
                      <span className="text-muted-foreground">{f.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleClose}>Close</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
