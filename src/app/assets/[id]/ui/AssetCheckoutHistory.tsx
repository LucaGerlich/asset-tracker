"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { ClipboardCheck, LogOut, LogIn, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CheckoutUser {
  userid: string;
  firstname: string;
  lastname: string;
}

interface Checkout {
  id: string;
  assetId: string;
  checkedOutTo: string;
  checkedOutBy: string;
  checkoutDate: string;
  expectedReturn: string | null;
  returnDate: string | null;
  notes: string | null;
  status: string;
  checkedOutToUser: CheckoutUser;
  checkedOutByUser: CheckoutUser;
}

interface UserOption {
  userid: string;
  firstname: string;
  lastname: string;
  username: string | null;
  email: string | null;
}

interface AssetCheckoutHistoryProps {
  assetId: string;
  assetName: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusBadge(status: string, expectedReturn: string | null) {
  if (status === "returned") {
    return (
      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
        Returned
      </Badge>
    );
  }
  if (
    status === "checked_out" &&
    expectedReturn &&
    new Date(expectedReturn) < new Date()
  ) {
    return (
      <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
        Overdue
      </Badge>
    );
  }
  if (status === "checked_out") {
    return (
      <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
        Checked Out
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AssetCheckoutHistory({
  assetId,
  assetName,
}: AssetCheckoutHistoryProps) {
  const { data: session } = useSession();
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

  // Form state
  const [selectedUserId, setSelectedUserId] = useState("");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [notes, setNotes] = useState("");

  // User options for selector
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchCheckouts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/asset/checkout?assetId=${assetId}`);
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to fetch checkouts");
        return;
      }
      const data: Checkout[] = await res.json();
      setCheckouts(data);
    } catch {
      toast.error("Failed to connect to the server");
    } finally {
      setIsLoading(false);
    }
  }, [assetId]);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/user");
      if (res.ok) {
        const data: UserOption[] = await res.json();
        setUsers(data);
      }
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchCheckouts();
  }, [fetchCheckouts]);

  const handleDialogOpen = (open: boolean) => {
    setDialogOpen(open);
    if (open) {
      fetchUsers();
    } else {
      setSelectedUserId("");
      setExpectedReturn("");
      setNotes("");
    }
  };

  const handleCheckout = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, string | undefined> = {
        assetId,
        checkedOutTo: selectedUserId,
        expectedReturn: expectedReturn || undefined,
        notes: notes || undefined,
      };

      const res = await fetch("/api/asset/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to create checkout");
        return;
      }

      toast.success("Asset checked out successfully");
      setDialogOpen(false);
      setSelectedUserId("");
      setExpectedReturn("");
      setNotes("");
      fetchCheckouts();
    } catch {
      toast.error("Failed to connect to the server");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckIn = async (checkoutId: string) => {
    setCheckingIn(checkoutId);
    try {
      const res = await fetch(`/api/asset/checkout/${checkoutId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to check in asset");
        return;
      }

      toast.success("Asset checked in successfully");
      fetchCheckouts();
    } catch {
      toast.error("Failed to connect to the server");
    } finally {
      setCheckingIn(null);
    }
  };

  if (!session) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <ClipboardCheck className="h-5 w-5" />
          Checkout History
        </h3>
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <LogOut className="mr-2 h-4 w-4" />
              Check Out
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Check Out Asset</DialogTitle>
              <DialogDescription>
                Check out &quot;{assetName}&quot; to a user.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="checkout-user">User</Label>
                {loadingUsers ? (
                  <p className="text-muted-foreground text-sm">
                    Loading users...
                  </p>
                ) : (
                  <Select
                    value={selectedUserId}
                    onValueChange={setSelectedUserId}
                  >
                    <SelectTrigger id="checkout-user">
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.userid} value={u.userid}>
                          {u.firstname} {u.lastname}
                          {u.email ? ` (${u.email})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="expected-return">
                  Expected Return Date (optional)
                </Label>
                <Input
                  id="expected-return"
                  type="date"
                  value={expectedReturn}
                  onChange={(e) => setExpectedReturn(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="checkout-notes">Notes (optional)</Label>
                <Textarea
                  id="checkout-notes"
                  placeholder="Add any notes about this checkout..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCheckout}
                disabled={submitting || !selectedUserId}
              >
                {submitting ? "Checking out..." : "Confirm Checkout"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading checkouts...</p>
      ) : checkouts.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No checkouts recorded for this asset.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pr-4 pb-2 font-medium">User</th>
                <th className="pr-4 pb-2 font-medium">Checkout Date</th>
                <th className="pr-4 pb-2 font-medium">Expected Return</th>
                <th className="pr-4 pb-2 font-medium">Actual Return</th>
                <th className="pr-4 pb-2 font-medium">Status</th>
                <th className="pr-4 pb-2 font-medium">Notes</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {checkouts.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-3 pr-4">
                    {c.checkedOutToUser
                      ? `${c.checkedOutToUser.firstname} ${c.checkedOutToUser.lastname}`
                      : c.checkedOutTo}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {formatDate(c.checkoutDate)}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {formatDate(c.expectedReturn)}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {formatDate(c.returnDate)}
                  </td>
                  <td className="py-3 pr-4">
                    {getStatusBadge(c.status, c.expectedReturn)}
                  </td>
                  <td className="text-muted-foreground max-w-[150px] truncate py-3 pr-4">
                    {c.notes || "-"}
                  </td>
                  <td className="py-3">
                    {c.status === "checked_out" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCheckIn(c.id)}
                        disabled={checkingIn === c.id}
                      >
                        {checkingIn === c.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <LogIn className="mr-1 h-4 w-4" />
                            Check In
                          </>
                        )}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
