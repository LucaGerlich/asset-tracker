"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ShoppingCart, Send, Save } from "lucide-react";

interface LineItem {
  id: string;
  entityType: string;
  description: string;
  quantity: number;
  estimatedUnitCost: number;
}

const ENTITY_TYPES = [
  { value: "asset", label: "Asset" },
  { value: "accessory", label: "Accessory" },
  { value: "consumable", label: "Consumable" },
  { value: "licence", label: "Licence" },
  { value: "other", label: "Other" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    amount,
  );

function generateId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function createEmptyItem(): LineItem {
  return {
    id: generateId(),
    entityType: "asset",
    description: "",
    quantity: 1,
    estimatedUnitCost: 0,
  };
}

export default function CreatePurchaseRequest() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([createEmptyItem()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const runningTotal = items.reduce(
    (sum, item) => sum + item.quantity * item.estimatedUnitCost,
    0,
  );

  const handleAddItem = () => {
    setItems((prev) => [...prev, createEmptyItem()]);
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => {
      if (prev.length <= 1) {
        toast.error("At least one line item is required");
        return prev;
      }
      return prev.filter((item) => item.id !== itemId);
    });
  };

  const handleItemChange = (
    itemId: string,
    field: keyof Omit<LineItem, "id">,
    value: string | number,
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item,
      ),
    );
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      toast.error("Title is required");
      return false;
    }
    for (const item of items) {
      if (!item.description.trim()) {
        toast.error("All line items must have a description");
        return false;
      }
      if (item.quantity < 1) {
        toast.error("Quantity must be at least 1");
        return false;
      }
      if (item.estimatedUnitCost < 0) {
        toast.error("Unit cost cannot be negative");
        return false;
      }
    }
    return true;
  };

  const handleSave = async (submitAfterSave: boolean) => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        notes: notes.trim() || null,
        items: items.map(({ id: _id, ...rest }) => rest),
      };

      const response = await fetch("/api/procurement/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to create purchase request");
        return;
      }

      const created = await response.json();
      const requestId = created.id || created.data?.id;

      if (submitAfterSave && requestId) {
        const submitResponse = await fetch(
          `/api/procurement/requests/${requestId}/submit`,
          { method: "POST" },
        );
        if (!submitResponse.ok) {
          const submitData = await submitResponse.json();
          toast.error(
            submitData.error ||
              "Request saved but failed to submit for approval",
          );
          router.push(`/procurement/${requestId}`);
          return;
        }
        toast.success("Purchase request submitted for approval");
      } else {
        toast.success("Purchase request saved as draft");
      }

      router.push(`/procurement/${requestId}`);
    } catch {
      toast.error("Failed to connect to the server");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ShoppingCart className="h-6 w-6" />
          New Purchase Request
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Create a purchase request for items to be procured
        </p>
      </div>

      {/* Request Details */}
      <Card>
        <CardHeader>
          <CardTitle>Request Details</CardTitle>
          <CardDescription>
            Provide the basic information for this purchase request
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Q2 Laptop Refresh"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the purpose of this purchase request..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={priority}
              onValueChange={setPriority}
              disabled={isSubmitting}
            >
              <SelectTrigger id="priority" className="w-48">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes or justification..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={isSubmitting}
            />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
          <CardDescription>Add the items you need to purchase</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => (
            <div key={item.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm font-medium">
                  Item {index + 1}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveItem(item.id)}
                  disabled={isSubmitting || items.length <= 1}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="space-y-1">
                  <Label>Entity Type</Label>
                  <Select
                    value={item.entityType}
                    onValueChange={(value) =>
                      handleItemChange(item.id, "entityType", value)
                    }
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITY_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Description *</Label>
                  <Input
                    placeholder='e.g., MacBook Pro 14"'
                    value={item.description}
                    onChange={(e) =>
                      handleItemChange(item.id, "description", e.target.value)
                    }
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      handleItemChange(
                        item.id,
                        "quantity",
                        parseInt(e.target.value, 10) || 1,
                      )
                    }
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Est. Unit Cost ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.estimatedUnitCost}
                    onChange={(e) =>
                      handleItemChange(
                        item.id,
                        "estimatedUnitCost",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="text-muted-foreground text-right text-sm">
                Subtotal:{" "}
                {formatCurrency(item.quantity * item.estimatedUnitCost)}
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            onClick={handleAddItem}
            disabled={isSubmitting}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>

          <div className="flex justify-end border-t pt-4">
            <div className="text-lg font-semibold">
              Estimated Total: {formatCurrency(runningTotal)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/procurement")}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleSave(false)}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save as Draft
        </Button>
        <Button onClick={() => handleSave(true)} disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Submit for Approval
        </Button>
      </div>
    </div>
  );
}
