"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { toast } from "sonner";
import { Plus, Trash2, ArrowRight } from "lucide-react";

interface StatusType {
  statustypeid: string;
  statustypename: string;
}

interface Transition {
  id: string;
  fromStatusId: string;
  toStatusId: string;
  requiredRole: string | null;
  notifyOnTransition: boolean;
  fromStatus: StatusType;
  toStatus: StatusType;
}

export default function StatusWorkflowTab({
  statuses,
}: {
  statuses: StatusType[];
}) {
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    fromStatusId: "",
    toStatusId: "",
    requiredRole: "",
    notifyOnTransition: false,
  });

  const fetchTransitions = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/status-workflow");
      if (res.ok) setTransitions(await res.json());
    } catch (err) {
      console.error("Failed to fetch workflow transitions", err);
      toast.error("Failed to fetch workflow transitions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransitions();
  }, [fetchTransitions]);

  const handleCreate = async () => {
    if (!formData.fromStatusId || !formData.toStatusId) {
      toast.error("Select both from and to status");
      return;
    }
    try {
      const res = await fetch("/api/admin/status-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          requiredRole: formData.requiredRole || null,
        }),
      });
      if (res.ok) {
        const newTransition = await res.json();
        setTransitions([...transitions, newTransition]);
        setIsDialogOpen(false);
        setFormData({
          fromStatusId: "",
          toStatusId: "",
          requiredRole: "",
          notifyOnTransition: false,
        });
        toast.success("Transition added");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to create transition");
      }
    } catch (err) {
      console.error("Failed to create transition", err);
      toast.error("Failed to create transition");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch("/api/admin/status-workflow", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setTransitions(transitions.filter((t) => t.id !== id));
        toast.success("Transition removed");
      }
    } catch (err) {
      console.error("Failed to remove transition", err);
      toast.error("Failed to remove transition");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Status Workflow</CardTitle>
            <CardDescription>
              Define allowed status transitions. When configured, assets can
              only move between statuses that have a transition defined here. If
              no transitions are defined, any status change is allowed.
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Transition
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Status Transition</DialogTitle>
                <DialogDescription>
                  Define an allowed transition from one status to another
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From Status</Label>
                    <Select
                      value={formData.fromStatusId}
                      onValueChange={(v) =>
                        setFormData({ ...formData, fromStatusId: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => (
                          <SelectItem
                            key={s.statustypeid}
                            value={s.statustypeid}
                          >
                            {s.statustypename}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>To Status</Label>
                    <Select
                      value={formData.toStatusId}
                      onValueChange={(v) =>
                        setFormData({ ...formData, toStatusId: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => (
                          <SelectItem
                            key={s.statustypeid}
                            value={s.statustypeid}
                          >
                            {s.statustypename}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Required Role (optional)</Label>
                  <Input
                    value={formData.requiredRole}
                    onChange={(e) =>
                      setFormData({ ...formData, requiredRole: e.target.value })
                    }
                    placeholder="e.g., admin (leave blank for any role)"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="notifyOnTransition"
                    checked={formData.notifyOnTransition}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        notifyOnTransition: checked as boolean,
                      })
                    }
                  />
                  <label htmlFor="notifyOnTransition" className="text-sm">
                    Send notification when this transition occurs
                  </label>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreate}>Add Transition</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead />
                  <TableHead>To</TableHead>
                  <TableHead>Required Role</TableHead>
                  <TableHead>Notify</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transitions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {t.fromStatus.statustypename}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="text-muted-foreground h-4 w-4" />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {t.toStatus.statustypename}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {t.requiredRole || "Any"}
                    </TableCell>
                    <TableCell>
                      {t.notifyOnTransition ? (
                        <Badge variant="secondary">Yes</Badge>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(t.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {transitions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center">
                      <p className="text-muted-foreground">
                        No transitions defined — all status changes are
                        currently allowed
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
