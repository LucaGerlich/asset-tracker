"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, ShoppingCart, Plus, Eye, FileText } from "lucide-react";

interface PurchaseRequestUser {
  userid: string;
  firstname: string;
  lastname: string;
  email: string;
}

interface PurchaseRequestItem {
  id: string;
  entityType: string;
  description: string;
  quantity: number;
  estimatedUnitCost: number;
}

interface PurchaseRequest {
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
  requester: PurchaseRequestUser;
  approvedBy: PurchaseRequestUser | null;
  items: PurchaseRequestItem[];
}

type StatusFilter =
  | "all"
  | "draft"
  | "pending_approval"
  | "approved"
  | "ordered"
  | "received"
  | "cancelled";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "ordered", label: "Ordered" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
];

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

function calculateEstimatedTotal(items: PurchaseRequestItem[]): number {
  return items.reduce(
    (sum, item) => sum + item.quantity * item.estimatedUnitCost,
    0,
  );
}

export default function ProcurementList() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<StatusFilter>("all");

  const fetchRequests = useCallback(async (status: StatusFilter) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "all") {
        params.set("status", status);
      }
      const response = await fetch(
        `/api/procurement/requests?${params.toString()}`,
      );
      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to fetch purchase requests");
        setRequests([]);
        return;
      }
      const data = await response.json();
      setRequests(Array.isArray(data) ? data : data.data || []);
    } catch {
      toast.error("Failed to connect to the server");
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests(activeTab);
  }, [fetchRequests, activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value as StatusFilter);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ShoppingCart className="h-6 w-6" />
            Procurement
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage purchase requests and track orders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/procurement/orders">
              <FileText className="mr-2 h-4 w-4" />
              Purchase Orders
            </Link>
          </Button>
          <Button asChild>
            <Link href="/procurement/create">
              <Plus className="mr-2 h-4 w-4" />
              New Request
            </Link>
          </Button>
        </div>
      </div>

      {/* Status filter tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingCart className="text-muted-foreground mb-4 h-12 w-12" />
              <h3 className="text-lg font-medium">
                No purchase requests found
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {activeTab === "all"
                  ? "There are no purchase requests yet. Create one to get started."
                  : `There are no ${activeTab.replace("_", " ")} purchase requests.`}
              </p>
              <Button asChild className="mt-4">
                <Link href="/procurement/create">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Request
                </Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">
                      Estimated Total
                    </TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {request.title}
                      </TableCell>
                      <TableCell>
                        {getPriorityBadge(request.priority)}
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(
                          calculateEstimatedTotal(request.items || []),
                        )}
                      </TableCell>
                      <TableCell>
                        {request.requester
                          ? `${request.requester.firstname} ${request.requester.lastname}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {new Date(request.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/procurement/${request.id}`}>
                            <Eye className="mr-1 h-4 w-4" />
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
