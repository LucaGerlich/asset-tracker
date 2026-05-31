"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ShoppingCart,
  Rocket,
  Activity,
  Wrench,
  Archive,
  Trash2,
  ChevronRight,
  Check,
} from "lucide-react";

const LIFECYCLE_STAGES = [
  {
    key: "procured",
    label: "Procured",
    icon: ShoppingCart,
    color: "text-blue-600 bg-blue-100 border-blue-300",
  },
  {
    key: "deployed",
    label: "Deployed",
    icon: Rocket,
    color: "text-indigo-600 bg-indigo-100 border-indigo-300",
  },
  {
    key: "active",
    label: "Active",
    icon: Activity,
    color: "text-green-600 bg-green-100 border-green-300",
  },
  {
    key: "maintenance",
    label: "Maintenance",
    icon: Wrench,
    color: "text-yellow-600 bg-yellow-100 border-yellow-300",
  },
  {
    key: "retired",
    label: "Retired",
    icon: Archive,
    color: "text-orange-600 bg-orange-100 border-orange-300",
  },
  {
    key: "disposed",
    label: "Disposed",
    icon: Trash2,
    color: "text-red-600 bg-red-100 border-red-300",
  },
];

function mapStatusToStage(
  statusName: string | null,
  isAssigned: boolean,
): string {
  if (!statusName) return "procured";
  const lower = statusName.toLowerCase();

  if (
    lower.includes("dispos") ||
    lower.includes("recycl") ||
    lower.includes("scrap")
  )
    return "disposed";
  if (
    lower.includes("retir") ||
    lower.includes("decommission") ||
    lower.includes("end of life")
  )
    return "retired";
  if (
    lower.includes("maint") ||
    lower.includes("repair") ||
    lower.includes("service")
  )
    return "maintenance";
  if (
    lower.includes("active") ||
    lower.includes("in use") ||
    lower.includes("assigned")
  )
    return isAssigned ? "active" : "deployed";
  if (
    lower.includes("deploy") ||
    lower.includes("ready") ||
    lower.includes("provisioned") ||
    lower.includes("available")
  )
    return "deployed";
  if (
    lower.includes("procur") ||
    lower.includes("ordered") ||
    lower.includes("pending") ||
    lower.includes("new")
  )
    return "procured";

  return isAssigned ? "active" : "deployed";
}

interface AssetLifecycleProps {
  assetId: string;
  currentStatus: string | null;
  isAssigned: boolean;
  statuses: Array<{ statustypeid: string; statustypename: string }>;
  onStatusChange?: () => void;
  isAdmin?: boolean;
}

export default function AssetLifecycle({
  assetId,
  currentStatus,
  isAssigned,
  statuses,
  onStatusChange,
  isAdmin = true,
}: AssetLifecycleProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const currentStage = mapStatusToStage(currentStatus, isAssigned);
  const currentStageIndex = LIFECYCLE_STAGES.findIndex(
    (s) => s.key === currentStage,
  );

  const handleTransition = async () => {
    if (!selectedStatus) {
      toast.error("Please select a new status");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/asset", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetid: assetId,
          statustypeid: selectedStatus,
          notes: notes || undefined,
        }),
      });

      if (response.ok) {
        toast.success("Asset lifecycle status updated");
        setDialogOpen(false);
        setNotes("");
        setSelectedStatus("");
        onStatusChange?.();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update status");
      }
    } catch (err) {
      console.error("Failed to update status", err);
      toast.error("Failed to update status");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground-600 text-sm font-semibold">Lifecycle</h3>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
          >
            Update Status
          </Button>
        )}
      </div>

      {/* Lifecycle Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto py-2">
        {LIFECYCLE_STAGES.map((stage, index) => {
          const Icon = stage.icon;
          const isPast = index < currentStageIndex;
          const isCurrent = index === currentStageIndex;
          const isFuture = index > currentStageIndex;

          return (
            <React.Fragment key={stage.key}>
              {index > 0 && (
                <ChevronRight
                  className={`h-4 w-4 shrink-0 ${isPast ? "text-green-400" : "text-muted-foreground/30"}`}
                />
              )}
              <div
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                  isCurrent
                    ? stage.color
                    : isPast
                      ? "border-green-200 bg-green-50 text-green-600"
                      : "bg-muted/30 text-muted-foreground border-muted"
                } ${isFuture ? "opacity-40" : ""}`}
              >
                {isPast ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                {stage.label}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <p className="text-muted-foreground text-xs">
        Current status:{" "}
        <span className="font-medium">{currentStatus || "Unknown"}</span>
      </p>

      {/* Transition Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Lifecycle Status</DialogTitle>
            <DialogDescription>
              Change the asset status to transition it through the lifecycle.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lifecycle-status">New Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger id="lifecycle-status">
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.statustypeid} value={s.statustypeid}>
                      {s.statustypename}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lifecycle-notes">Notes (optional)</Label>
              <Input
                id="lifecycle-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for status change"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransition}
              disabled={isSaving || !selectedStatus}
            >
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
