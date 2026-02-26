"use client";

import React, { useState } from "react";
import Link from "next/link";
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
import { Toaster, toast } from "sonner";

interface Asset {
  assetid: string;
  assetname: string;
  assettag: string;
}

interface Checkout {
  id: string;
  quantity: number;
  notes: string | null;
  checkedOutAt: string;
  asset: Asset;
  checkedOutByUser: { userid: string; firstname: string; lastname: string };
}

export default function ComponentDetailClient({
  componentId,
  remainingQuantity,
  assets,
  checkouts,
}: {
  componentId: string;
  remainingQuantity: number;
  assets: Asset[];
  checkouts: Checkout[];
}) {
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutAssetId, setCheckoutAssetId] = useState("");
  const [checkoutQty, setCheckoutQty] = useState("1");
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCheckout = async () => {
    if (!checkoutAssetId) {
      toast.error("Please select an asset");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/components/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          componentId,
          assetId: checkoutAssetId,
          quantity: Number(checkoutQty) || 1,
          notes: checkoutNotes || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Checkout failed");
      }

      toast.success("Component checked out to asset");
      window.location.reload();
    } catch (err: any) {
      toast.error("Checkout failed", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckin = async (checkoutId: string) => {
    if (!confirm("Return this component?")) return;
    try {
      const res = await fetch(`/api/components/checkout/${checkoutId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Returned" }),
      });
      if (!res.ok) throw new Error("Check-in failed");
      toast.success("Component returned");
      window.location.reload();
    } catch {
      toast.error("Check-in failed");
    }
  };

  return (
    <div className="rounded-lg border border-default-200 p-4">
      <Toaster position="bottom-right" />
      <h2 className="text-sm font-semibold text-foreground-600 mb-3">
        Actions & Active Checkouts
      </h2>

      {remainingQuantity > 0 && (
        <Button
          size="sm"
          className="mb-4 w-full"
          onClick={() => setShowCheckout(!showCheckout)}
        >
          {showCheckout ? "Cancel" : "Checkout to Asset"}
        </Button>
      )}

      {showCheckout && (
        <div className="space-y-3 mb-4 p-3 bg-muted/50 rounded-md">
          <div className="space-y-1">
            <Label>Asset</Label>
            <Select value={checkoutAssetId} onValueChange={setCheckoutAssetId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an asset" />
              </SelectTrigger>
              <SelectContent>
                {assets.map((a) => (
                  <SelectItem key={a.assetid} value={a.assetid}>
                    {a.assetname} ({a.assettag})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Quantity</Label>
            <Input
              type="number"
              min={1}
              max={remainingQuantity}
              value={checkoutQty}
              onChange={(e) => setCheckoutQty(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Input
              value={checkoutNotes}
              onChange={(e) => setCheckoutNotes(e.target.value)}
              placeholder="Optional notes..."
            />
          </div>
          <Button size="sm" onClick={handleCheckout} disabled={submitting}>
            {submitting ? "Checking out..." : "Confirm Checkout"}
          </Button>
        </div>
      )}

      {checkouts.length === 0 ? (
        <p className="text-sm text-foreground-500">No active checkouts.</p>
      ) : (
        <div className="space-y-2">
          {checkouts.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between p-2 rounded-md border text-sm"
            >
              <div>
                <Link
                  href={`/assets/${c.asset.assetid}`}
                  className="text-primary hover:underline font-medium"
                >
                  {c.asset.assetname}
                </Link>
                <span className="text-muted-foreground ml-2">x{c.quantity}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleCheckin(c.id)}>
                Return
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
