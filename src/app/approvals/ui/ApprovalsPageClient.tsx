"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSession, type SessionUser } from "@/lib/auth-client";
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
import {
  Loader2,
  CheckCircle,
  XCircle,
  ClipboardList,
  CalendarClock,
  PackageOpen,
} from "lucide-react";

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

interface ReservationAsset {
  assetid: string;
  assetname: string;
  assettag: string;
}

interface ReservationUser {
  userid: string;
  firstname: string;
  lastname: string;
}

interface Reservation {
  id: string;
  assetId: string;
  userId: string;
  startDate: string;
  endDate: string;
  status: string;
  notes: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  asset: ReservationAsset;
  user: ReservationUser;
}

interface ItemRequestUser {
  userid: string;
  firstname: string;
  lastname: string;
  email?: string;
}

interface ItemRequest {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string;
  userId: string;
  status: string;
  notes: string | null;
  quantity: number;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: ItemRequestUser;
  approver: ItemRequestUser | null;
}

interface ApprovalsPageClientProps {
  isAdmin: boolean;
}

export default function ApprovalsPageClient({
  isAdmin,
}: ApprovalsPageClientProps) {
  const { data: session } = useSession();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingReservations, setIsLoadingReservations] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<"approve" | "reject">(
    "approve",
  );
  const [selectedApproval, setSelectedApproval] =
    useState<ApprovalRequest | null>(null);
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false);
  const [reservationDialogAction, setReservationDialogAction] = useState<
    "approve" | "reject"
  >("approve");
  const [actionNotes, setActionNotes] = useState("");
  const [reservationActionNotes, setReservationActionNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingReservation, setIsSubmittingReservation] = useState(false);

  const [itemRequests, setItemRequests] = useState<ItemRequest[]>([]);
  const [isLoadingItemRequests, setIsLoadingItemRequests] = useState(true);
  const [selectedItemRequest, setSelectedItemRequest] =
    useState<ItemRequest | null>(null);
  const [itemRequestDialogOpen, setItemRequestDialogOpen] = useState(false);
  const [itemRequestDialogAction, setItemRequestDialogAction] = useState<
    "approve" | "reject" | "returned"
  >("approve");
  const [itemRequestActionNotes, setItemRequestActionNotes] = useState("");
  const [isSubmittingItemRequest, setIsSubmittingItemRequest] = useState(false);

  const [approvalsPage, setApprovalsPage] = useState(1);
  const [reservationsPage, setReservationsPage] = useState(1);
  const [itemRequestsPage, setItemRequestsPage] = useState(1);

  const user = session?.user as SessionUser | undefined;
  const userIsAdmin = user?.isadmin || isAdmin;

  const ITEMS_PER_PAGE = 20;

  const getEntityUrl = (entityType: string, entityId: string): string => {
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
  };

  const approvalsPages = Math.max(
    1,
    Math.ceil(approvals.length / ITEMS_PER_PAGE),
  );
  const paginatedApprovals = useMemo(() => {
    const start = (approvalsPage - 1) * ITEMS_PER_PAGE;
    return approvals.slice(start, start + ITEMS_PER_PAGE);
  }, [approvals, approvalsPage]);

  const reservationsPages = Math.max(
    1,
    Math.ceil(reservations.length / ITEMS_PER_PAGE),
  );
  const paginatedReservations = useMemo(() => {
    const start = (reservationsPage - 1) * ITEMS_PER_PAGE;
    return reservations.slice(start, start + ITEMS_PER_PAGE);
  }, [reservations, reservationsPage]);

  const itemRequestsPages = Math.max(
    1,
    Math.ceil(itemRequests.length / ITEMS_PER_PAGE),
  );
  const paginatedItemRequests = useMemo(() => {
    const start = (itemRequestsPage - 1) * ITEMS_PER_PAGE;
    return itemRequests.slice(start, start + ITEMS_PER_PAGE);
  }, [itemRequests, itemRequestsPage]);

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
    } catch (err) {
      console.error("Failed to connect to the server", err);
      toast.error("Failed to connect to the server");
      setApprovals([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchReservations = useCallback(async (status?: string) => {
    setIsLoadingReservations(true);
    try {
      const params = new URLSearchParams();
      if (status && status !== "all") {
        params.set("status", status);
      }
      const response = await fetch(
        `/api/asset/reservations?${params.toString()}`,
      );
      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to fetch reservations");
        setReservations([]);
        return;
      }
      const data = await response.json();
      setReservations(data);
    } catch (err) {
      console.error("Failed to connect to the server", err);
      toast.error("Failed to connect to the server");
      setReservations([]);
    } finally {
      setIsLoadingReservations(false);
    }
  }, []);

  const fetchItemRequests = useCallback(async (status?: string) => {
    setIsLoadingItemRequests(true);
    try {
      const params = new URLSearchParams();
      if (status && status !== "all") {
        params.set("status", status);
      }
      const response = await fetch(`/api/requests?${params.toString()}`);
      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to fetch item requests");
        setItemRequests([]);
        return;
      }
      const data = await response.json();
      setItemRequests(data);
    } catch (err) {
      console.error("Failed to connect to the server", err);
      toast.error("Failed to connect to the server");
      setItemRequests([]);
    } finally {
      setIsLoadingItemRequests(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals(activeTab);
    fetchReservations(activeTab);
    fetchItemRequests(activeTab);
  }, [fetchApprovals, fetchReservations, fetchItemRequests, activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setApprovalsPage(1);
    setReservationsPage(1);
    setItemRequestsPage(1);
  };

  const openConfirmDialog = (
    approval: ApprovalRequest,
    action: "approve" | "reject",
  ) => {
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
          : "Approval request rejected successfully",
      );

      setDialogOpen(false);
      fetchApprovals(activeTab);
    } catch (err) {
      console.error(`Failed to ${dialogAction} request`, err);
      toast.error(`Failed to ${dialogAction} request`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openReservationConfirmDialog = (
    reservation: Reservation,
    action: "approve" | "reject",
  ) => {
    setSelectedReservation(reservation);
    setReservationDialogAction(action);
    setReservationActionNotes("");
    setReservationDialogOpen(true);
  };

  const handleConfirmReservationAction = async () => {
    if (!selectedReservation) return;

    setIsSubmittingReservation(true);
    try {
      const newStatus =
        reservationDialogAction === "approve" ? "approved" : "rejected";
      const response = await fetch("/api/asset/reservations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedReservation.id,
          status: newStatus,
          notes: reservationActionNotes || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(
          data.error || `Failed to ${reservationDialogAction} reservation`,
        );
        return;
      }

      toast.success(
        reservationDialogAction === "approve"
          ? "Reservation approved and asset assigned"
          : "Reservation rejected",
      );

      setReservationDialogOpen(false);
      fetchReservations(activeTab);
    } catch (err) {
      console.error(`Failed to ${reservationDialogAction} reservation`, err);
      toast.error(`Failed to ${reservationDialogAction} reservation`);
    } finally {
      setIsSubmittingReservation(false);
    }
  };

  const openItemRequestConfirmDialog = (
    itemRequest: ItemRequest,
    action: "approve" | "reject" | "returned",
  ) => {
    setSelectedItemRequest(itemRequest);
    setItemRequestDialogAction(action);
    setItemRequestActionNotes("");
    setItemRequestDialogOpen(true);
  };

  const handleConfirmItemRequestAction = async () => {
    if (!selectedItemRequest) return;

    setIsSubmittingItemRequest(true);
    try {
      const statusMap: Record<string, string> = {
        approve: "approved",
        reject: "rejected",
        returned: "returned",
      };
      const newStatus = statusMap[itemRequestDialogAction] || "rejected";
      const response = await fetch("/api/requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedItemRequest.id,
          status: newStatus,
          notes: itemRequestActionNotes || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(
          data.error || `Failed to ${itemRequestDialogAction} item request`,
        );
        return;
      }

      const successMessages: Record<string, string> = {
        approve: "Item request approved and auto-assigned",
        reject: "Item request rejected",
        returned: "Return confirmed — item unassigned",
      };
      toast.success(successMessages[itemRequestDialogAction] || "Done");

      setItemRequestDialogOpen(false);
      fetchItemRequests(activeTab);
    } catch (err) {
      console.error(`Failed to ${itemRequestDialogAction} item request`, err);
      toast.error(`Failed to ${itemRequestDialogAction} item request`);
    } finally {
      setIsSubmittingItemRequest(false);
    }
  };

  const entityTypeBadgeClass = (entityType: string): string => {
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
  };

  const getStatusBadge = (status: string) => {
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
      case "return_pending":
        return (
          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
            Return Pending
          </Badge>
        );
      case "returned":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            Returned
          </Badge>
        );
      case "overdue":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            Overdue
          </Badge>
        );
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
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ClipboardList className="h-6 w-6" />
          Approval Workflows
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
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
            <div className="flex items-center justify-center py-12">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
          ) : approvals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardList className="text-muted-foreground mb-4 h-12 w-12" />
              <h3 className="text-lg font-medium">
                No approval requests found
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
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
                  {paginatedApprovals.map((approval) => (
                    <TableRow key={approval.id}>
                      <TableCell>
                        <Badge variant="outline">{approval.entityType}</Badge>
                      </TableCell>
                      <TableCell>
                        {approval.requester.firstname}{" "}
                        {approval.requester.lastname}
                      </TableCell>
                      <TableCell
                        className="font-mono text-xs"
                        title={approval.entityId}
                      >
                        <Link
                          href={getEntityUrl(
                            approval.entityType,
                            approval.entityId,
                          )}
                          className="text-primary hover:underline"
                        >
                          {truncateId(approval.entityId)}
                        </Link>
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
                                onClick={() =>
                                  openConfirmDialog(approval, "approve")
                                }
                              >
                                <CheckCircle className="mr-1 h-4 w-4" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  openConfirmDialog(approval, "reject")
                                }
                              >
                                <XCircle className="mr-1 h-4 w-4" />
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
          {approvals.length > 0 && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-muted-foreground text-sm">
                {approvals.length} total approval
                {approvals.length !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setApprovalsPage(Math.max(1, approvalsPage - 1))
                  }
                  disabled={approvalsPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {approvalsPage} of {approvalsPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setApprovalsPage(
                      Math.min(approvalsPages, approvalsPage + 1),
                    )
                  }
                  disabled={approvalsPage === approvalsPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Reservations Section */}
      <div className="space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <CalendarClock className="h-5 w-5" />
            Asset Reservations
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Review and manage asset reservation requests
          </p>
        </div>

        {isLoadingReservations ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        ) : reservations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarClock className="text-muted-foreground mb-4 h-12 w-12" />
            <h3 className="text-lg font-medium">No reservations found</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {activeTab === "all"
                ? "There are no asset reservations yet"
                : `There are no ${activeTab} reservations`}
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Name</TableHead>
                  <TableHead>Asset Tag</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                  {userIsAdmin && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedReservations.map((reservation) => (
                  <TableRow key={reservation.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/assets/${reservation.assetId}`}
                        className="text-primary hover:underline"
                      >
                        {reservation.asset.assetname}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {reservation.asset.assettag}
                    </TableCell>
                    <TableCell>
                      {reservation.user.firstname} {reservation.user.lastname}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(reservation.startDate).toLocaleDateString()} -{" "}
                      {new Date(reservation.endDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {reservation.notes || "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(reservation.status)}</TableCell>
                    {userIsAdmin && (
                      <TableCell>
                        {reservation.status === "pending" && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() =>
                                openReservationConfirmDialog(
                                  reservation,
                                  "approve",
                                )
                              }
                            >
                              <CheckCircle className="mr-1 h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                openReservationConfirmDialog(
                                  reservation,
                                  "reject",
                                )
                              }
                            >
                              <XCircle className="mr-1 h-4 w-4" />
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
        {reservations.length > 0 && (
          <div className="flex items-center justify-between pt-4">
            <span className="text-muted-foreground text-sm">
              {reservations.length} total reservation
              {reservations.length !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setReservationsPage(Math.max(1, reservationsPage - 1))
                }
                disabled={reservationsPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {reservationsPage} of {reservationsPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setReservationsPage(
                    Math.min(reservationsPages, reservationsPage + 1),
                  )
                }
                disabled={reservationsPage === reservationsPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Item Requests Section */}
      <div className="space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <PackageOpen className="h-5 w-5" />
            Item Requests
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Review and manage item checkout requests
          </p>
        </div>

        {isLoadingItemRequests ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        ) : itemRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <PackageOpen className="text-muted-foreground mb-4 h-12 w-12" />
            <h3 className="text-lg font-medium">No item requests found</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {activeTab === "all"
                ? "There are no item requests yet"
                : `There are no ${activeTab} item requests`}
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Requested Date</TableHead>
                  <TableHead>Status</TableHead>
                  {userIsAdmin && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItemRequests.map((ir) => (
                  <TableRow key={ir.id}>
                    <TableCell>
                      <Badge
                        className={`capitalize ${entityTypeBadgeClass(ir.entityType)}`}
                      >
                        {ir.entityType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={getEntityUrl(ir.entityType, ir.entityId)}
                        className="text-primary hover:underline"
                      >
                        {ir.entityName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {ir.user.firstname} {ir.user.lastname}
                    </TableCell>
                    <TableCell>{ir.quantity > 1 ? ir.quantity : "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {ir.notes || "-"}
                    </TableCell>
                    <TableCell>
                      {new Date(ir.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{getStatusBadge(ir.status)}</TableCell>
                    {userIsAdmin && (
                      <TableCell>
                        {ir.status === "pending" && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() =>
                                openItemRequestConfirmDialog(ir, "approve")
                              }
                            >
                              <CheckCircle className="mr-1 h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                openItemRequestConfirmDialog(ir, "reject")
                              }
                            >
                              <XCircle className="mr-1 h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        )}
                        {ir.status === "return_pending" && (
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() =>
                              openItemRequestConfirmDialog(ir, "returned")
                            }
                          >
                            <CheckCircle className="mr-1 h-4 w-4" />
                            Confirm Collection
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {itemRequests.length > 0 && (
          <div className="flex items-center justify-between pt-4">
            <span className="text-muted-foreground text-sm">
              {itemRequests.length} total item request
              {itemRequests.length !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setItemRequestsPage(Math.max(1, itemRequestsPage - 1))
                }
                disabled={itemRequestsPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {itemRequestsPage} of {itemRequestsPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setItemRequestsPage(
                    Math.min(itemRequestsPages, itemRequestsPage + 1),
                  )
                }
                disabled={itemRequestsPage === itemRequestsPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Item Request Confirmation Dialog */}
      <Dialog
        open={itemRequestDialogOpen}
        onOpenChange={setItemRequestDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {itemRequestDialogAction === "approve"
                ? "Approve Item Request"
                : itemRequestDialogAction === "returned"
                  ? "Confirm Item Collection"
                  : "Reject Item Request"}
            </DialogTitle>
            <DialogDescription>
              {itemRequestDialogAction === "approve"
                ? "Are you sure you want to approve this request? The item will be automatically assigned."
                : itemRequestDialogAction === "returned"
                  ? "Confirm that you have collected this item from the user. The item will be unassigned and set to Available."
                  : "Are you sure you want to reject this request?"}
              {selectedItemRequest && (
                <span className="mt-2 block">
                  <strong>Type:</strong> {selectedItemRequest.entityType}
                  {" | "}
                  <strong>Item:</strong> {selectedItemRequest.entityName}
                  {" | "}
                  <strong>Requester:</strong>{" "}
                  {selectedItemRequest.user.firstname}{" "}
                  {selectedItemRequest.user.lastname}
                  {selectedItemRequest.quantity > 1 && (
                    <>
                      {" | "}
                      <strong>Quantity:</strong> {selectedItemRequest.quantity}
                    </>
                  )}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="item-request-action-notes">Notes (optional)</Label>
            <Textarea
              id="item-request-action-notes"
              placeholder="Add any notes about this decision..."
              value={itemRequestActionNotes}
              onChange={(e) => setItemRequestActionNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setItemRequestDialogOpen(false)}
              disabled={isSubmittingItemRequest}
            >
              Cancel
            </Button>
            <Button
              variant={
                itemRequestDialogAction === "reject" ? "destructive" : "default"
              }
              className={
                itemRequestDialogAction === "approve"
                  ? "bg-green-600 hover:bg-green-700"
                  : itemRequestDialogAction === "returned"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : ""
              }
              onClick={handleConfirmItemRequestAction}
              disabled={isSubmittingItemRequest}
            >
              {isSubmittingItemRequest ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              {itemRequestDialogAction === "approve"
                ? "Approve"
                : itemRequestDialogAction === "returned"
                  ? "Confirm Collection"
                  : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "approve"
                ? "Approve Request"
                : "Reject Request"}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === "approve"
                ? "Are you sure you want to approve this request?"
                : "Are you sure you want to reject this request?"}
              {selectedApproval && (
                <span className="mt-2 block">
                  <strong>Type:</strong> {selectedApproval.entityType}
                  {" | "}
                  <strong>Requester:</strong>{" "}
                  {selectedApproval.requester.firstname}{" "}
                  {selectedApproval.requester.lastname}
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
              className={
                dialogAction === "approve"
                  ? "bg-green-600 hover:bg-green-700"
                  : ""
              }
              onClick={handleConfirmAction}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : dialogAction === "approve" ? (
                <CheckCircle className="mr-2 h-4 w-4" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              {dialogAction === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reservation Confirmation Dialog */}
      <Dialog
        open={reservationDialogOpen}
        onOpenChange={setReservationDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reservationDialogAction === "approve"
                ? "Approve Reservation"
                : "Reject Reservation"}
            </DialogTitle>
            <DialogDescription>
              {reservationDialogAction === "approve"
                ? "Are you sure you want to approve this reservation? The asset will be automatically assigned to the requester."
                : "Are you sure you want to reject this reservation?"}
              {selectedReservation && (
                <span className="mt-2 block">
                  <strong>Asset:</strong> {selectedReservation.asset.assetname}{" "}
                  ({selectedReservation.asset.assettag}){" | "}
                  <strong>Requester:</strong>{" "}
                  {selectedReservation.user.firstname}{" "}
                  {selectedReservation.user.lastname}
                  {" | "}
                  <strong>Dates:</strong>{" "}
                  {new Date(selectedReservation.startDate).toLocaleDateString()}{" "}
                  - {new Date(selectedReservation.endDate).toLocaleDateString()}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reservation-action-notes">Notes (optional)</Label>
            <Textarea
              id="reservation-action-notes"
              placeholder="Add any notes about this decision..."
              value={reservationActionNotes}
              onChange={(e) => setReservationActionNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReservationDialogOpen(false)}
              disabled={isSubmittingReservation}
            >
              Cancel
            </Button>
            <Button
              variant={
                reservationDialogAction === "approve"
                  ? "default"
                  : "destructive"
              }
              className={
                reservationDialogAction === "approve"
                  ? "bg-green-600 hover:bg-green-700"
                  : ""
              }
              onClick={handleConfirmReservationAction}
              disabled={isSubmittingReservation}
            >
              {isSubmittingReservation ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : reservationDialogAction === "approve" ? (
                <CheckCircle className="mr-2 h-4 w-4" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              {reservationDialogAction === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
