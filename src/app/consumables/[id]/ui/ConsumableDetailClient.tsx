"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { PackageMinus, PackagePlus, Bell } from "lucide-react";

interface User {
  userid: string;
  firstname: string;
  lastname: string;
}

interface Checkout {
  id: string;
  quantity: number;
  notes: string | null;
  checkedOutAt: string;
  user: User;
}

interface ConsumableDetailClientProps {
  consumableId: string;
  currentQuantity: number;
  users: User[];
  checkouts: Checkout[];
  hasStockAlert: boolean;
}

export default function ConsumableDetailClient({
  consumableId,
  currentQuantity,
  users,
  checkouts: initialCheckouts,
  hasStockAlert,
}: ConsumableDetailClientProps) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [restockOpen, setRestockOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [qty, setQty] = useState(currentQuantity);
  const [restockQty, setRestockQty] = useState("1");

  // Checkout form
  const [checkoutUserId, setCheckoutUserId] = useState("");
  const [checkoutQty, setCheckoutQty] = useState("1");
  const [checkoutNotes, setCheckoutNotes] = useState("");

  // Stock alert form
  const [alertMin, setAlertMin] = useState("10");
  const [alertCritical, setAlertCritical] = useState("5");
  const [alertEmail, setAlertEmail] = useState(true);

  const handleCheckout = async () => {
    if (!checkoutUserId) {
      toast.error("Please select a user");
      return;
    }
    const amount = Number(checkoutQty);
    if (!amount || amount < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }
    if (amount > qty) {
      toast.error("Insufficient stock", {
        description: `Only ${qty} available`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/consumable/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consumableId,
          userId: checkoutUserId,
          quantity: amount,
          notes: checkoutNotes || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Checkout failed");
      }

      toast.success("Checkout successful", {
        description: `${amount} item(s) checked out`,
      });
      setQty((prev) => prev - amount);
      setCheckoutOpen(false);
      setCheckoutUserId("");
      setCheckoutQty("1");
      setCheckoutNotes("");
    } catch (err) {
      toast.error("Checkout failed", {
        description: (err as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestock = async () => {
    const amount = Number(restockQty);
    if (!amount || amount < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/consumable", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consumableid: consumableId,
          addQuantity: amount,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Restock failed");
      }

      toast.success("Restock successful", {
        description: `Added ${amount} item(s) to stock`,
      });
      setQty((prev) => prev + amount);
      setRestockOpen(false);
      setRestockQty("1");
    } catch (err) {
      toast.error("Restock failed", {
        description: (err as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAlert = async () => {
    const minVal = Number(alertMin);
    const critVal = Number(alertCritical);
    if (critVal > minVal) {
      toast.error("Critical threshold must be less than minimum threshold");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/stock-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consumableId,
          minThreshold: minVal,
          criticalThreshold: critVal,
          emailNotify: alertEmail,
          webhookNotify: false,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create alert");
      }

      toast.success("Stock alert created");
      setAlertOpen(false);
    } catch (err) {
      toast.error("Failed to create alert", {
        description: (err as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-default-200 rounded-lg border p-4">
      <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
        Actions
      </h2>
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => setCheckoutOpen(true)}
          disabled={qty <= 0}
        >
          <PackageMinus className="mr-2 h-4 w-4" />
          Check Out to User
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => setRestockOpen(true)}
        >
          <PackagePlus className="mr-2 h-4 w-4" />
          Restock
        </Button>

        {!hasStockAlert && (
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setAlertOpen(true)}
          >
            <Bell className="mr-2 h-4 w-4" />
            Set Up Stock Alert
          </Button>
        )}

        <div className="bg-muted/50 mt-3 rounded-md p-3">
          <div className="text-foreground-500 mb-1 text-xs">
            Available Stock
          </div>
          <div className="text-2xl font-bold">{qty}</div>
        </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check Out Consumable</DialogTitle>
            <DialogDescription>
              Assign items to a user. Stock will be decremented.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div>
              <Label htmlFor="checkout-user">User</Label>
              <Select value={checkoutUserId} onValueChange={setCheckoutUserId}>
                <SelectTrigger id="checkout-user">
                  <SelectValue placeholder="Select user..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.userid} value={u.userid}>
                      {u.firstname} {u.lastname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="checkout-qty">Quantity</Label>
              <Input
                id="checkout-qty"
                type="number"
                min="1"
                max={qty}
                value={checkoutQty}
                onChange={(e) => setCheckoutQty(e.target.value)}
              />
              <p className="text-foreground-500 mt-1 text-xs">
                {qty} available
              </p>
            </div>
            <div>
              <Label htmlFor="checkout-notes">Notes (optional)</Label>
              <Input
                id="checkout-notes"
                value={checkoutNotes}
                onChange={(e) => setCheckoutNotes(e.target.value)}
                placeholder="Reason for checkout..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCheckoutOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCheckout} disabled={submitting}>
              {submitting ? "Processing..." : "Check Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restock Dialog */}
      <Dialog open={restockOpen} onOpenChange={setRestockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restock Consumable</DialogTitle>
            <DialogDescription>
              Add inventory to increase available stock.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div>
              <Label htmlFor="restock-qty">Quantity to Add</Label>
              <Input
                id="restock-qty"
                type="number"
                min="1"
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRestockOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRestock} disabled={submitting}>
              {submitting ? "Restocking..." : "Restock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Alert Dialog */}
      <Dialog open={alertOpen} onOpenChange={setAlertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Up Stock Alert</DialogTitle>
            <DialogDescription>
              Get notified when stock falls below thresholds.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div>
              <Label htmlFor="alert-min">Minimum Threshold</Label>
              <Input
                id="alert-min"
                type="number"
                min="1"
                value={alertMin}
                onChange={(e) => setAlertMin(e.target.value)}
              />
              <p className="text-foreground-500 mt-1 text-xs">
                Alert when stock drops to this level
              </p>
            </div>
            <div>
              <Label htmlFor="alert-critical">Critical Threshold</Label>
              <Input
                id="alert-critical"
                type="number"
                min="0"
                value={alertCritical}
                onChange={(e) => setAlertCritical(e.target.value)}
              />
              <p className="text-foreground-500 mt-1 text-xs">
                Urgent alert when stock drops to this level
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="alert-email"
                checked={alertEmail}
                onCheckedChange={(checked) => setAlertEmail(checked === true)}
              />
              <Label htmlFor="alert-email" className="text-sm font-normal">
                Send email notifications
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAlertOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAlert} disabled={submitting}>
              {submitting ? "Creating..." : "Create Alert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
