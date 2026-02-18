"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, ClipboardList } from "lucide-react";

interface ApprovalUser {
  userid: string;
  firstname: string;
  lastname: string;
  email: string;
}

interface ApprovalRequest {
  id: string;
  entityType: string;
  entityId: string;
  requesterId: string;
  approverId: string | null;
  status: string;
  notes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  requester: ApprovalUser;
  approver: ApprovalUser | null;
}

interface ApprovalsPageClientProps {
  isAdmin: boolean;
}

export default function ApprovalsPageClient({ isAdmin }: ApprovalsPageClientProps) {
  const { data: session } = useSession();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<"approve" | "reject">("approve");
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userIsAdmin = session?.user?.isAdmin || isAdmin;

  const fetchApprovals = useCallback(async (status?: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (status && status !== "all") {
        params.set("status", status);
      }
      const response = await fetch(`/api/approvals?${params.toString()}`);
      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to fetch approvals");
        setApprovals([]);
        return;
      }
      const data = await response.json();
      setApprovals(data);
    } catch {
      toast.error("Failed to connect to the server");
      setApprovals([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals(activeTab);
  }, [fetchApprovals, activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  const openConfirmDialog = (approval: ApprovalRequest, action: "approve" | "reject") => {
    setSelectedApproval(approval);
    setDialogAction(action);
    setActionNotes("");
    setDialogOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedApproval) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/approvals/${selectedApproval.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: dialogAction,
          notes: actionNotes || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || `Failed to ${dialogAction} request`);
        return;
      }

      toast.success(
        dialogAction === "approve"
          ? "Approval request approved successfully"
          : "Approval request rejected successfully"
      );

      setDialogOpen(false);
      fetchApprovals(activeTab);
    } catch {
      toast.error(`Failed to ${dialogAction} request`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>;
      case "approved":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const truncateId = (id: string) => {
    if (id.length <= 12) return id;
    return `${id.substring(0, 8)}...`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ClipboardList className="h-6 w-6" />
          Approval Workflows
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and manage approval requests
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : approvals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No approval requests found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {activeTab === "all"
                  ? "There are no approval requests yet"
                  : `There are no ${activeTab} approval requests`}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Requested Date</TableHead>
                    <TableHead>Status</TableHead>
                    {userIsAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvals.map((approval) => (
                    <TableRow key={approval.id}>
                      <TableCell>
                        <Badge variant="outline">{approval.entityType}</Badge>
                      </TableCell>
                      <TableCell>
                        {approval.requester.firstname} {approval.requester.lastname}
                      </TableCell>
                      <TableCell
                        className="font-mono text-xs"
                        title={approval.entityId}
                      >
                        {truncateId(approval.entityId)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {approval.notes || "-"}
                      </TableCell>
                      <TableCell>
                        {new Date(approval.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(approval.status)}</TableCell>
                      {userIsAdmin && (
                        <TableCell>
                          {approval.status === "pending" && (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => openConfirmDialog(approval, "approve")}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => openConfirmDialog(approval, "reject")}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "approve" ? "Approve Request" : "Reject Request"}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === "approve"
                ? "Are you sure you want to approve this request?"
                : "Are you sure you want to reject this request?"}
              {selectedApproval && (
                <span className="block mt-2">
                  <strong>Type:</strong> {selectedApproval.entityType}
                  {" | "}
                  <strong>Requester:</strong>{" "}
                  {selectedApproval.requester.firstname} {selectedApproval.requester.lastname}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="action-notes">Notes (optional)</Label>
            <Textarea
              id="action-notes"
              placeholder="Add any notes about this decision..."
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant={dialogAction === "approve" ? "default" : "destructive"}
              className={dialogAction === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
              onClick={handleConfirmAction}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : dialogAction === "approve" ? (
                <CheckCircle className="h-4 w-4 mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              {dialogAction === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
