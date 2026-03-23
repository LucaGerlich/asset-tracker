"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession, type SessionUser } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Calendar, Plus, Loader2, Check, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  asset: {
    assetid: string;
    assetname: string;
    assettag: string;
  };
  user: {
    userid: string;
    firstname: string;
    lastname: string;
  };
}

interface AssetReservationsProps {
  assetId: string;
  assetName: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-100";
    case "approved":
      return "bg-green-100 text-green-800 border-green-300 hover:bg-green-100";
    case "rejected":
      return "bg-red-100 text-red-800 border-red-300 hover:bg-red-100";
    case "cancelled":
      return "bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-100";
    default:
      return "";
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AssetReservations({
  assetId,
  assetName,
}: AssetReservationsProps) {
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const isAdmin = user?.isadmin ?? false;

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  // ---------------------------------------------------------------------------
  // Fetch reservations
  // ---------------------------------------------------------------------------

  const fetchReservations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/asset/reservations?assetId=${encodeURIComponent(assetId)}`,
      );
      if (!res.ok) {
        throw new Error("Failed to fetch reservations");
      }
      const data = await res.json();
      setReservations(data);
    } catch (error) {
      console.error("Error fetching reservations:", error);
      toast.error("Failed to load reservations");
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // ---------------------------------------------------------------------------
  // Create reservation
  // ---------------------------------------------------------------------------

  const handleCreateReservation = async () => {
    if (!startDate || !endDate) {
      toast.error("Please select both start and end dates");
      return;
    }

    if (new Date(startDate) >= new Date(endDate)) {
      toast.error("End date must be after start date");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/asset/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId,
          startDate,
          endDate,
          notes: notes || undefined,
        }),
      });

      if (res.status === 409) {
        toast.error(
          "This asset already has a reservation for the selected dates",
        );
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create reservation");
      }

      toast.success("Reservation request submitted");
      setDialogOpen(false);
      resetForm();
      fetchReservations();
    } catch (error) {
      console.error("Error creating reservation:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create reservation",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Update reservation status
  // ---------------------------------------------------------------------------

  const handleUpdateStatus = async (
    reservationId: string,
    newStatus: string,
  ) => {
    try {
      const res = await fetch("/api/asset/reservations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reservationId, status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update reservation");
      }

      const statusMessages: Record<string, string> = {
        approved: "Reservation approved",
        rejected: "Reservation rejected",
        cancelled: "Reservation cancelled",
      };
      toast.success(statusMessages[newStatus] || "Reservation updated");
      fetchReservations();
    } catch (error) {
      console.error("Error updating reservation:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update reservation",
      );
    }
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const resetForm = () => {
    setStartDate("");
    setEndDate("");
    setNotes("");
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Calendar className="h-5 w-5" />
          Reservations
        </h3>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Request Reservation
        </Button>
      </div>

      {/* Reservations Table */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : reservations.length === 0 ? (
        <div className="text-muted-foreground py-8 text-center">
          No reservations found for this asset.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>User</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.map((reservation) => {
                const isOwner = reservation.userId === session?.user?.id;

                return (
                  <TableRow key={reservation.id}>
                    <TableCell>
                      {reservation.user.firstname} {reservation.user.lastname}
                    </TableCell>
                    <TableCell>{formatDate(reservation.startDate)}</TableCell>
                    <TableCell>{formatDate(reservation.endDate)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusBadgeClass(reservation.status)}
                      >
                        {reservation.status.charAt(0).toUpperCase() +
                          reservation.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {reservation.notes || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {/* Admin: approve/reject pending reservations */}
                        {isAdmin && reservation.status === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-green-600 hover:bg-green-50 hover:text-green-700"
                              onClick={() =>
                                handleUpdateStatus(reservation.id, "approved")
                              }
                              title="Approve"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() =>
                                handleUpdateStatus(reservation.id, "rejected")
                              }
                              title="Reject"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {/* Owner or Admin: cancel pending/approved reservations */}
                        {(isOwner || isAdmin) &&
                          (reservation.status === "pending" ||
                            reservation.status === "approved") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-gray-600 hover:bg-gray-50 hover:text-gray-700"
                              onClick={() =>
                                handleUpdateStatus(reservation.id, "cancelled")
                              }
                              title="Cancel"
                            >
                              Cancel
                            </Button>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Reservation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Reservation</DialogTitle>
            <DialogDescription>
              Request a reservation for {assetName}. An admin will review your
              request.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this reservation..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateReservation} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
