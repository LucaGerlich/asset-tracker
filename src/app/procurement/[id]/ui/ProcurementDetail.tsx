"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Send,
  Pencil,
  Trash2,
  ShoppingCart,
  FileText,
  Package,
} from "lucide-react";

interface RequestUser {
  userid: string;
  firstname: string;
  lastname: string;
  email: string;
}

interface RequestItem {
  id: string;
  entityType: string;
  description: string;
  quantity: number;
  estimatedUnitCost: number;
  receivedQuantity: number;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  status: string;
}

interface PurchaseRequestDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  notes: string | null;
  requesterId: string;
  approvedById: string | null;
  createdAt: string;
  updatedAt: string;
  requester: RequestUser;
  approvedBy: RequestUser | null;
  items: RequestItem[];
  purchaseOrders: PurchaseOrder[];
  department: string | null;
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    amount,
  );

function getPriorityBadge(priority: string) {
  switch (priority) {
    case "low":
      return (
        <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
          Low
        </Badge>
      );
    case "medium":
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          Medium
        </Badge>
      );
    case "high":
      return (
        <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
          High
        </Badge>
      );
    case "urgent":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          Urgent
        </Badge>
      );
    default:
      return <Badge variant="secondary">{priority}</Badge>;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "draft":
      return (
        <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
          Draft
        </Badge>
      );
    case "pending_approval":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          Pending Approval
        </Badge>
      );
    case "approved":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          Approved
        </Badge>
      );
    case "ordered":
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          Ordered
        </Badge>
      );
    case "received":
      return (
        <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
          Received
        </Badge>
      );
    case "cancelled":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          Cancelled
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function ProcurementDetail() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.id as string;

  const [request, setRequest] = useState<PurchaseRequestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const fetchRequest = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/procurement/requests/${requestId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("Purchase request not found");
          router.push("/procurement");
          return;
        }
        const data = await response.json();
        toast.error(data.error || "Failed to fetch purchase request");
        return;
      }
      const data = await response.json();
      setRequest(data);
    } catch {
      toast.error("Failed to connect to the server");
    } finally {
      setIsLoading(false);
    }
  }, [requestId, router]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  const handleSubmitForApproval = async () => {
    setIsActioning(true);
    try {
      const response = await fetch(
        `/api/procurement/requests/${requestId}/submit`,
        { method: "POST" },
      );
      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to submit for approval");
        return;
      }
      toast.success("Request submitted for approval");
      fetchRequest();
    } catch {
      toast.error("Failed to connect to the server");
    } finally {
      setIsActioning(false);
    }
  };

  const handleApprove = async () => {
    setIsActioning(true);
    try {
      const response = await fetch(
        `/api/procurement/requests/${requestId}/approve`,
        { method: "POST" },
      );
      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to approve request");
        return;
      }
      toast.success("Request approved");
      fetchRequest();
    } catch {
      toast.error("Failed to connect to the server");
    } finally {
      setIsActioning(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    setIsActioning(true);
    try {
      const response = await fetch(
        `/api/procurement/requests/${requestId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: rejectReason.trim() }),
        },
      );
      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to reject request");
        return;
      }
      toast.success("Request rejected");
      setRejectDialogOpen(false);
      setRejectReason("");
      fetchRequest();
    } catch {
      toast.error("Failed to connect to the server");
    } finally {
      setIsActioning(false);
    }
  };

  const handleDelete = async () => {
    setIsActioning(true);
    try {
      const response = await fetch(`/api/procurement/requests/${requestId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to delete request");
        return;
      }
      toast.success("Request deleted");
      router.push("/procurement");
    } catch {
      toast.error("Failed to connect to the server");
    } finally {
      setIsActioning(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleGeneratePO = async () => {
    setIsActioning(true);
    try {
      const response = await fetch(
        `/api/procurement/requests/${requestId}/generate-po`,
        { method: "POST" },
      );
      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to generate purchase order");
        return;
      }
      const data = await response.json();
      toast.success("Purchase order generated");
      const poId = data.id || data.data?.id;
      if (poId) {
        router.push(`/procurement/orders/${poId}`);
      } else {
        fetchRequest();
      }
    } catch {
      toast.error("Failed to connect to the server");
    } finally {
      setIsActioning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ShoppingCart className="text-muted-foreground mb-4 h-12 w-12" />
        <h3 className="text-lg font-medium">Purchase request not found</h3>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/procurement">Back to Procurement</Link>
        </Button>
      </div>
    );
  }

  const estimatedTotal = request.items.reduce(
    (sum, item) => sum + item.quantity * item.estimatedUnitCost,
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            {request.title}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            {getStatusBadge(request.status)}
            {getPriorityBadge(request.priority)}
          </div>
        </div>

        {/* Action buttons based on status */}
        <div className="flex items-center gap-2">
          {request.status === "draft" && (
            <>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={isActioning}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/procurement/${requestId}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </Button>
              <Button onClick={handleSubmitForApproval} disabled={isActioning}>
                {isActioning ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Submit for Approval
              </Button>
            </>
          )}

          {request.status === "pending_approval" && (
            <>
              <Button
                variant="destructive"
                onClick={() => setRejectDialogOpen(true)}
                disabled={isActioning}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={handleApprove}
                disabled={isActioning}
              >
                {isActioning ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Approve
              </Button>
            </>
          )}

          {request.status === "approved" && (
            <Button onClick={handleGeneratePO} disabled={isActioning}>
              {isActioning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Generate Purchase Order
            </Button>
          )}
        </div>
      </div>

      {/* Request info */}
      <Card>
        <CardHeader>
          <CardTitle>Request Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-muted-foreground text-sm">Requester</p>
              <p className="font-medium">
                {request.requester.firstname} {request.requester.lastname}
              </p>
            </div>
            {request.department && (
              <div>
                <p className="text-muted-foreground text-sm">Department</p>
                <p className="font-medium">{request.department}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground text-sm">Created</p>
              <p className="font-medium">
                {new Date(request.createdAt).toLocaleDateString()}
              </p>
            </div>
            {request.approvedBy && (
              <div>
                <p className="text-muted-foreground text-sm">Approved By</p>
                <p className="font-medium">
                  {request.approvedBy.firstname} {request.approvedBy.lastname}
                </p>
              </div>
            )}
            {request.description && (
              <div className="sm:col-span-2 lg:col-span-3">
                <p className="text-muted-foreground text-sm">Description</p>
                <p className="font-medium">{request.description}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Items table */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
          <CardDescription>
            {request.items.length} item{request.items.length !== 1 ? "s" : ""} -
            Estimated total: {formatCurrency(estimatedTotal)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {request.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {item.entityType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.description}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.estimatedUnitCost)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.quantity * item.estimatedUnitCost)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.receivedQuantity ?? 0}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={4} className="text-right font-semibold">
                    Estimated Total
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(estimatedTotal)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {request.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{request.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Linked Purchase Orders */}
      {request.status === "ordered" &&
        request.purchaseOrders &&
        request.purchaseOrders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Linked Purchase Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {request.purchaseOrders.map((po) => (
                  <div
                    key={po.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-medium">
                        {po.poNumber}
                      </span>
                      <Badge variant="outline">{po.status}</Badge>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/procurement/orders/${po.id}`}>
                        View Order
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Received info */}
      {request.status === "received" && (
        <Card>
          <CardHeader>
            <CardTitle>Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              All items have been received and the request is complete.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Purchase Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this purchase request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason *</Label>
            <Textarea
              id="reject-reason"
              placeholder="Explain why this request is being rejected..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={isActioning}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isActioning || !rejectReason.trim()}
            >
              {isActioning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Purchase Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this purchase request? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isActioning}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isActioning}
            >
              {isActioning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
