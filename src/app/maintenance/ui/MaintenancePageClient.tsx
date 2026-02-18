"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dialog";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { toast } from "sonner";
import { Plus, CheckCircle, Trash2, Loader2, Wrench } from "lucide-react";

interface Asset {
  assetid: string;
  assetname: string;
}

interface User {
  userid: string;
  firstname: string;
  lastname: string;
}

interface MaintenanceSchedule {
  id: string;
  title: string;
  description: string | null;
  frequency: string;
  nextDueDate: string;
  lastCompletedAt: string | null;
  estimatedCost: number | null;
  isActive: boolean;
  assetId: string;
  assignedTo: string | null;
  asset: { assetid: string; assetname: string };
  user: { userid: string; firstname: string; lastname: string } | null;
}

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
];

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getStatusInfo(nextDueDate: string): {
  label: string;
  className: string;
} {
  const now = new Date();
  const due = new Date(nextDueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) {
    return { label: "Overdue", className: "bg-red-100 text-red-800 border-red-200" };
  }
  if (diffDays <= 7) {
    return { label: "Due Soon", className: "bg-yellow-100 text-yellow-800 border-yellow-200" };
  }
  return { label: "Scheduled", className: "bg-green-100 text-green-800 border-green-200" };
}

export default function MaintenancePageClient() {
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [formAssetId, setFormAssetId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formFrequency, setFormFrequency] = useState("");
  const [formNextDueDate, setFormNextDueDate] = useState("");
  const [formAssignedTo, setFormAssignedTo] = useState("");
  const [formEstimatedCost, setFormEstimatedCost] = useState("");

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<MaintenanceSchedule | null>(null);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/maintenance");
      if (!res.ok) throw new Error("Failed to fetch schedules");
      const data = await res.json();
      setSchedules(data);
    } catch (err) {
      console.error("Error fetching maintenance schedules:", err);
      toast.error("Failed to load maintenance schedules");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch("/api/asset");
      if (!res.ok) throw new Error("Failed to fetch assets");
      const data = await res.json();
      // Handle paginated response
      setAssets(data.data || data);
    } catch (err) {
      console.error("Error fetching assets:", err);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/user");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      // Handle paginated response
      setUsers(data.data || data);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
    fetchAssets();
    fetchUsers();
  }, [fetchSchedules, fetchAssets, fetchUsers]);

  const resetForm = () => {
    setFormAssetId("");
    setFormTitle("");
    setFormDescription("");
    setFormFrequency("");
    setFormNextDueDate("");
    setFormAssignedTo("");
    setFormEstimatedCost("");
  };

  const handleCreate = async () => {
    if (!formTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!formAssetId) {
      toast.error("Please select an asset");
      return;
    }
    if (!formFrequency) {
      toast.error("Please select a frequency");
      return;
    }
    if (!formNextDueDate) {
      toast.error("Next due date is required");
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        title: formTitle.trim(),
        assetId: formAssetId,
        frequency: formFrequency,
        nextDueDate: formNextDueDate,
      };
      if (formDescription.trim()) body.description = formDescription.trim();
      if (formAssignedTo) body.assignedTo = formAssignedTo;
      if (formEstimatedCost) body.estimatedCost = Number(formEstimatedCost);

      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create schedule");
      }

      toast.success("Maintenance schedule created");
      setCreateOpen(false);
      resetForm();
      await fetchSchedules();
    } catch (err) {
      toast.error("Failed to create schedule", {
        description: (err as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (schedule: MaintenanceSchedule) => {
    try {
      const res = await fetch(`/api/maintenance/${schedule.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to complete maintenance");
      }

      toast.success("Maintenance marked as complete", {
        description: `Next due date has been updated for "${schedule.title}"`,
      });
      await fetchSchedules();
    } catch (err) {
      toast.error("Failed to complete maintenance", {
        description: (err as Error).message,
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedSchedule) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/maintenance/${selectedSchedule.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to delete schedule");
      }

      toast.success("Maintenance schedule deleted", {
        description: `"${selectedSchedule.title}" has been removed`,
      });
      setDeleteOpen(false);
      setSelectedSchedule(null);
      await fetchSchedules();
    } catch (err) {
      toast.error("Failed to delete schedule", {
        description: (err as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: "assetName", label: "Asset Name" },
    { key: "title", label: "Title" },
    { key: "frequency", label: "Frequency" },
    { key: "assignedTo", label: "Assigned To" },
    { key: "nextDueDate", label: "Next Due Date" },
    { key: "status", label: "Status" },
    { key: "actions", label: "Actions" },
  ];

  const renderCell = (item: MaintenanceSchedule, columnKey: string) => {
    switch (columnKey) {
      case "assetName":
        return item.asset?.assetname || "-";
      case "title":
        return item.title;
      case "frequency":
        return capitalize(item.frequency);
      case "assignedTo":
        return item.user
          ? `${item.user.firstname} ${item.user.lastname}`
          : "-";
      case "nextDueDate":
        return formatDate(item.nextDueDate);
      case "status": {
        const status = getStatusInfo(item.nextDueDate);
        return (
          <Badge className={status.className}>
            {status.label}
          </Badge>
        );
      }
      case "actions":
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleComplete(item)}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Mark Complete
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive h-8 w-8"
              onClick={() => {
                setSelectedSchedule(item);
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Maintenance Schedules</h1>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Schedule
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {schedules.length} schedule{schedules.length !== 1 ? "s" : ""} total
        </span>
      </div>

      <ResponsiveTable
        columns={columns}
        data={schedules}
        renderCell={renderCell}
        keyExtractor={(item) => item.id}
        emptyMessage="No maintenance schedules found"
        mobileCardView={true}
      />

      {/* Create Schedule Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => {
        setCreateOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Maintenance Schedule</DialogTitle>
            <DialogDescription>
              Set up a recurring maintenance schedule for an asset.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div>
              <Label htmlFor="form-asset">Asset</Label>
              <Select value={formAssetId} onValueChange={setFormAssetId}>
                <SelectTrigger id="form-asset">
                  <SelectValue placeholder="Select asset..." />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((a) => (
                    <SelectItem key={a.assetid} value={a.assetid}>
                      {a.assetname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="form-title">Title</Label>
              <Input
                id="form-title"
                placeholder="e.g. Oil Change, Filter Replacement"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="form-description">Description</Label>
              <Textarea
                id="form-description"
                placeholder="Optional details about this maintenance task..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="form-frequency">Frequency</Label>
              <Select value={formFrequency} onValueChange={setFormFrequency}>
                <SelectTrigger id="form-frequency">
                  <SelectValue placeholder="Select frequency..." />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="form-due-date">Next Due Date</Label>
              <Input
                id="form-due-date"
                type="date"
                value={formNextDueDate}
                onChange={(e) => setFormNextDueDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="form-assigned-to">Assigned To</Label>
              <Select value={formAssignedTo} onValueChange={setFormAssignedTo}>
                <SelectTrigger id="form-assigned-to">
                  <SelectValue placeholder="Select user (optional)..." />
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
            <div>
              <Label htmlFor="form-cost">Estimated Cost</Label>
              <Input
                id="form-cost"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formEstimatedCost}
                onChange={(e) => setFormEstimatedCost(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => {
              setCreateOpen(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? "Creating..." : "Create Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Maintenance Schedule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedSchedule?.title}&quot;? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={submitting}
            >
              {submitting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
