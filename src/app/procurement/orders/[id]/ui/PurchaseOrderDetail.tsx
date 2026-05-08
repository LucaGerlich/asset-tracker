"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  FileText,
  Download,
  Package,
  ArrowLeft,
  ClipboardCheck,
} from "lucide-react";

interface OrderItem {
  id: string;
  entityType: string;
  description: string;
  quantity: number;
  estimatedUnitCost: number;
  receivedQuantity: number;
}

interface GoodsReceiptItem {
  itemId: string;
  quantityReceived: number;
  condition: string;
}

interface GoodsReceipt {
  id: string;
  receivedAt: string;
  receivedById: string;
  receivedBy: {
    firstname: string;
    lastname: string;
  } | null;
  notes: string | null;
  items: GoodsReceiptItem[];
}

interface PurchaseOrderDetail {
  id: string;
  poNumber: string;
  supplier: string | null;
  status: string;
  total: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  goodsReceipts: GoodsReceipt[];
  purchaseRequestId: string | null;
}

interface ReceiptLineEntry {
  itemId: string;
  description: string;
  maxQuantity: number;
  quantityReceived: number;
  condition: string;
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    amount,
  );

const CONDITION_OPTIONS = [
  { value: "good", label: "Good" },
  { value: "damaged", label: "Damaged" },
  { value: "defective", label: "Defective" },
];

function getStatusBadge(status: string) {
  switch (status) {
    case "draft":
      return (
        <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
          Draft
        </Badge>
      );
    case "sent":
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          Sent
        </Badge>
      );
    case "acknowledged":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          Acknowledged
        </Badge>
      );
    case "partially_received":
      return (
        <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
          Partially Received
        </Badge>
      );
    case "received":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
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

export default function PurchaseOrderDetail() {
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<PurchaseOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptLines, setReceiptLines] = useState<ReceiptLineEntry[]>([]);
  const [receiptNotes, setReceiptNotes] = useState("");
  const [isSubmittingReceipt, setIsSubmittingReceipt] = useState(false);

  const fetchOrder = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/procurement/orders/${orderId}`);
      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to fetch purchase order");
        return;
      }
      const data = await response.json();
      setOrder(data);
    } catch {
      toast.error("Failed to connect to the server");
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const openReceiptDialog = () => {
    if (!order) return;

    const lines: ReceiptLineEntry[] = order.items.map((item) => {
      const remaining = item.quantity - (item.receivedQuantity ?? 0);
      return {
        itemId: item.id,
        description: item.description,
        maxQuantity: Math.max(0, remaining),
        quantityReceived: Math.max(0, remaining),
        condition: "good",
      };
    });

    setReceiptLines(lines);
    setReceiptNotes("");
    setReceiptDialogOpen(true);
  };

  const handleReceiptLineChange = (
    itemId: string,
    field: "quantityReceived" | "condition",
    value: string | number,
  ) => {
    setReceiptLines((prev) =>
      prev.map((line) =>
        line.itemId === itemId ? { ...line, [field]: value } : line,
      ),
    );
  };

  const handleSubmitReceipt = async () => {
    const hasAnyQuantity = receiptLines.some((l) => l.quantityReceived > 0);
    if (!hasAnyQuantity) {
      toast.error(
        "At least one item must have a received quantity greater than 0",
      );
      return;
    }

    for (const line of receiptLines) {
      if (line.quantityReceived > line.maxQuantity) {
        toast.error(
          `Received quantity for "${line.description}" exceeds remaining quantity`,
        );
        return;
      }
      if (line.quantityReceived < 0) {
        toast.error("Received quantity cannot be negative");
        return;
      }
    }

    setIsSubmittingReceipt(true);
    try {
      const payload = {
        items: receiptLines
          .filter((l) => l.quantityReceived > 0)
          .map((l) => ({
            itemId: l.itemId,
            quantityReceived: l.quantityReceived,
            condition: l.condition,
          })),
        notes: receiptNotes.trim() || null,
      };

      const response = await fetch(
        `/api/procurement/orders/${orderId}/receive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to record receipt");
        return;
      }

      toast.success("Goods receipt recorded successfully");
      setReceiptDialogOpen(false);
      fetchOrder();
    } catch {
      toast.error("Failed to connect to the server");
    } finally {
      setIsSubmittingReceipt(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="text-muted-foreground mb-4 h-12 w-12" />
        <h3 className="text-lg font-medium">Purchase order not found</h3>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/procurement/orders">Back to Purchase Orders</Link>
        </Button>
      </div>
    );
  }

  const hasOutstandingItems = order.items.some(
    (item) => (item.receivedQuantity ?? 0) < item.quantity,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <FileText className="h-6 w-6" />
            {order.poNumber}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            {getStatusBadge(order.status)}
            {order.supplier && (
              <span className="text-muted-foreground text-sm">
                Supplier: {order.supplier}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/procurement/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              window.open(`/api/procurement/orders/${orderId}/pdf`, "_blank")
            }
          >
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
          {hasOutstandingItems &&
            order.status !== "received" &&
            order.status !== "cancelled" && (
              <Button onClick={openReceiptDialog}>
                <Package className="mr-2 h-4 w-4" />
                Record Receipt
              </Button>
            )}
        </div>
      </div>

      {/* Order info */}
      <Card>
        <CardHeader>
          <CardTitle>Order Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-sm">PO Number</p>
              <p className="font-mono font-medium">{order.poNumber}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Supplier</p>
              <p className="font-medium">{order.supplier || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Total</p>
              <p className="font-medium">{formatCurrency(order.total)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Created</p>
              <p className="font-medium">
                {new Date(order.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line items */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
          <CardDescription>
            Items included in this purchase order
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Ordered Qty</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Received Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
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
                      <span
                        className={
                          (item.receivedQuantity ?? 0) >= item.quantity
                            ? "font-medium text-green-600"
                            : ""
                        }
                      >
                        {item.receivedQuantity ?? 0} / {item.quantity}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Goods Receipt History */}
      {order.goodsReceipts && order.goodsReceipts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Goods Receipt History
            </CardTitle>
            <CardDescription>
              {order.goodsReceipts.length} receipt
              {order.goodsReceipts.length !== 1 ? "s" : ""} recorded
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {order.goodsReceipts.map((receipt, index) => (
              <div key={receipt.id} className="space-y-2 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Receipt #{index + 1}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {new Date(receipt.receivedAt).toLocaleString()}
                    {receipt.receivedBy && (
                      <>
                        {" by "}
                        {receipt.receivedBy.firstname}{" "}
                        {receipt.receivedBy.lastname}
                      </>
                    )}
                  </span>
                </div>
                {receipt.notes && (
                  <p className="text-muted-foreground text-sm">
                    {receipt.notes}
                  </p>
                )}
                <div className="text-sm">
                  {receipt.items.map((ri) => {
                    const matchedItem = order.items.find(
                      (oi) => oi.id === ri.itemId,
                    );
                    return (
                      <div
                        key={ri.itemId}
                        className="flex items-center gap-4 py-1"
                      >
                        <span className="flex-1">
                          {matchedItem?.description || ri.itemId}
                        </span>
                        <span>Qty: {ri.quantityReceived}</span>
                        <Badge
                          variant="outline"
                          className={
                            ri.condition === "good"
                              ? "border-green-300 text-green-700"
                              : ri.condition === "damaged"
                                ? "border-orange-300 text-orange-700"
                                : "border-red-300 text-red-700"
                          }
                        >
                          {ri.condition}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Record Receipt Dialog */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record Goods Receipt</DialogTitle>
            <DialogDescription>
              Enter the quantity received and condition for each item.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 space-y-4 overflow-y-auto">
            {receiptLines.map((line) => (
              <div
                key={line.itemId}
                className="space-y-2 rounded-lg border p-3"
              >
                <p className="text-sm font-medium">{line.description}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Qty Received (max: {line.maxQuantity})</Label>
                    <Input
                      type="number"
                      min={0}
                      max={line.maxQuantity}
                      value={line.quantityReceived}
                      onChange={(e) =>
                        handleReceiptLineChange(
                          line.itemId,
                          "quantityReceived",
                          parseInt(e.target.value, 10) || 0,
                        )
                      }
                      disabled={isSubmittingReceipt}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Condition</Label>
                    <Select
                      value={line.condition}
                      onValueChange={(value) =>
                        handleReceiptLineChange(line.itemId, "condition", value)
                      }
                      disabled={isSubmittingReceipt}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
            <div className="space-y-1">
              <Label htmlFor="receipt-notes">Notes</Label>
              <Textarea
                id="receipt-notes"
                placeholder="Any notes about this delivery..."
                value={receiptNotes}
                onChange={(e) => setReceiptNotes(e.target.value)}
                rows={2}
                disabled={isSubmittingReceipt}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReceiptDialogOpen(false)}
              disabled={isSubmittingReceipt}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReceipt}
              disabled={isSubmittingReceipt}
            >
              {isSubmittingReceipt ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Package className="mr-2 h-4 w-4" />
              )}
              Record Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
