"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface KitItemInput {
  entityType: string;
  entityId: string;
  quantity: number;
  isRequired: boolean;
  notes: string;
}

export default function KitCreateForm({
  mode = "create",
  initialData,
}: {
  mode?: "create" | "edit";
  initialData?: {
    id: string;
    name: string;
    description: string;
    isActive: boolean;
    items: KitItemInput[];
  };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [items, setItems] = useState<KitItemInput[]>(initialData?.items || []);

  function addItem() {
    setItems([
      ...items,
      {
        entityType: "asset_category",
        entityId: "",
        quantity: 1,
        isRequired: true,
        notes: "",
      },
    ]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof KitItemInput, value: any) {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    setItems(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const body: any = { name, description, isActive, items };
      const url =
        mode === "edit" ? `/api/kits/${initialData!.id}` : "/api/kits";
      const method = mode === "edit" ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save kit");
      }

      toast.success(mode === "edit" ? "Kit updated" : "Kit created");
      router.push("/kits");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Kit Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="isActive"
          checked={isActive}
          onCheckedChange={(checked) => setIsActive(checked === true)}
        />
        <Label htmlFor="isActive">Active</Label>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Kit Items</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            Add Item
          </Button>
        </div>

        {items.map((item, i) => (
          <div key={i} className="flex items-end gap-2 rounded-md border p-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Type</Label>
              <Select
                value={item.entityType}
                onValueChange={(value) => updateItem(i, "entityType", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asset_category">Asset Category</SelectItem>
                  <SelectItem value="accessory">Accessory</SelectItem>
                  <SelectItem value="licence">Licence</SelectItem>
                  <SelectItem value="component">Component</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Entity ID</Label>
              <Input
                value={item.entityId}
                onChange={(e) => updateItem(i, "entityId", e.target.value)}
                placeholder="UUID"
              />
            </div>
            <div className="w-20 space-y-1">
              <Label className="text-xs">Qty</Label>
              <Input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) =>
                  updateItem(i, "quantity", Number(e.target.value))
                }
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeItem(i)}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading
            ? "Saving..."
            : mode === "edit"
              ? "Update Kit"
              : "Create Kit"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
