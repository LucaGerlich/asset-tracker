"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, FileText, Eye, Download, ArrowLeft } from "lucide-react";

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: string | null;
  status: string;
  total: number;
  createdAt: string;
  updatedAt: string;
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    amount,
  );

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

export default function PurchaseOrderList() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/procurement/orders");
      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to fetch purchase orders");
        setOrders([]);
        return;
      }
      const data = await response.json();
      setOrders(Array.isArray(data) ? data : data.data || []);
    } catch {
      toast.error("Failed to connect to the server");
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <FileText className="h-6 w-6" />
            Purchase Orders
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            View and manage purchase orders
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/procurement">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Procurement
          </Link>
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="text-muted-foreground mb-4 h-12 w-12" />
          <h3 className="text-lg font-medium">No purchase orders found</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Purchase orders are generated from approved purchase requests.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/procurement">View Purchase Requests</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-sm font-medium">
                    {order.poNumber}
                  </TableCell>
                  <TableCell>{order.supplier || "-"}</TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(order.total)}
                  </TableCell>
                  <TableCell>
                    {new Date(order.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/procurement/orders/${order.id}`}>
                          <Eye className="mr-1 h-4 w-4" />
                          View
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          window.open(
                            `/api/procurement/orders/${order.id}/pdf`,
                            "_blank",
                          )
                        }
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
