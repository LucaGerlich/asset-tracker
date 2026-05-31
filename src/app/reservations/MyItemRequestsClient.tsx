"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, PackageOpen, XCircle } from "lucide-react";
import { toast } from "sonner";
import ReturnItemButton from "@/components/ReturnItemButton";

interface ItemRequest {
  id: string;
  entityType: string;
  entityId?: string;
  entityName: string;
  status: string;
  notes: string | null;
  quantity: number;
  createdAt: string;
}

function entityTypeBadgeClass(entityType: string): string {
  switch (entityType) {
    case "asset":
      return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    case "accessory":
      return "bg-purple-100 text-purple-800 hover:bg-purple-100";
    case "consumable":
      return "bg-orange-100 text-orange-800 hover:bg-orange-100";
    case "licence":
      return "bg-teal-100 text-teal-800 hover:bg-teal-100";
    default:
      return "bg-gray-100 text-gray-800 hover:bg-gray-100";
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          Pending
        </Badge>
      );
    case "approved":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          Rejected
        </Badge>
      );
    case "cancelled":
      return (
        <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
          Cancelled
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

const ITEMS_PER_PAGE = 20;

function getEntityUrl(entityType: string, entityId?: string): string {
  if (!entityId) return "#";
  switch (entityType) {
    case "asset":
      return `/assets/${entityId}`;
    case "accessory":
      return `/accessories/${entityId}`;
    case "consumable":
      return `/consumables/${entityId}`;
    case "licence":
      return `/licences/${entityId}`;
    default:
      return "#";
  }
}

export default function MyItemRequestsClient() {
  const [requests, setRequests] = useState<ItemRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const pages = Math.max(1, Math.ceil(requests.length / ITEMS_PER_PAGE));
  const paginatedRequests = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return requests.slice(start, start + ITEMS_PER_PAGE);
  }, [requests, page]);

  const fetchRequests = useCallback(async () => {
    try {
      // Fetch from both the new ItemRequest system and legacy AssetReservation system
      const [itemRes, reservationRes] = await Promise.all([
        fetch("/api/requests?mine=true"),
        fetch("/api/asset/reservations"),
      ]);

      const items: ItemRequest[] = [];

      if (itemRes.ok) {
        const data = await itemRes.json();
        if (Array.isArray(data)) items.push(...data);
      }

      // Merge legacy asset reservations as ItemRequest-shaped objects
      if (reservationRes.ok) {
        const reservations = await reservationRes.json();
        if (Array.isArray(reservations)) {
          for (const r of reservations) {
            // Avoid duplicates — skip only if there's an active ItemRequest for the same asset
            const hasActiveItemRequest = items.some(
              (ir) =>
                ir.entityType === "asset" &&
                ir.entityId === r.assetId &&
                ["pending", "approved", "return_pending"].includes(ir.status),
            );
            if (!hasActiveItemRequest) {
              items.push({
                id: r.id,
                entityType: "asset",
                entityName: `${r.asset?.assetname || "Asset"} (${r.asset?.assettag || ""})`,
                entityId: r.assetId,
                status: r.status,
                notes: r.notes,
                quantity: 1,
                createdAt: r.createdAt,
              });
            }
          }
        }
      }

      // Sort by date descending
      items.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setRequests(items);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleCancel = async (id: string) => {
    try {
      const res = await fetch("/api/requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "cancelled" }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to cancel request");
        return;
      }
      toast.success("Request cancelled");
      fetchRequests();
    } catch (err) {
      console.error("Failed to cancel request", err);
      toast.error("Failed to cancel request");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <PackageOpen className="h-5 w-5" />
          My Item Requests
        </h2>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <PackageOpen className="h-5 w-5" />
          My Item Requests
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Track your item checkout requests
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <PackageOpen className="text-muted-foreground mb-4 h-12 w-12" />
          <h3 className="text-lg font-medium">No item requests</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            You haven&apos;t submitted any item requests yet
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRequests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Badge
                      className={`capitalize ${entityTypeBadgeClass(r.entityType)}`}
                    >
                      {r.entityType}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={getEntityUrl(r.entityType, r.entityId)}
                      className="text-primary hover:underline"
                    >
                      {r.entityName}
                    </Link>
                  </TableCell>
                  <TableCell>{r.quantity > 1 ? r.quantity : "-"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {r.notes || "-"}
                  </TableCell>
                  <TableCell>
                    {new Date(r.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{getStatusBadge(r.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {r.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCancel(r.id)}
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Cancel
                        </Button>
                      )}
                      {r.status === "approved" &&
                        r.entityType !== "consumable" && (
                          <ReturnItemButton
                            requestId={r.id}
                            entityName={r.entityName}
                            entityType={r.entityType}
                          />
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {requests.length > 0 && (
        <div className="flex items-center justify-between pt-4">
          <span className="text-muted-foreground text-sm">
            {requests.length} request
            {requests.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(pages, page + 1))}
              disabled={page === pages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
