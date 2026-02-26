"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface KitItem {
  id: string;
  entityType: string;
  entityId: string;
  quantity: number;
  isRequired: boolean;
}

interface Kit {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  items: KitItem[];
  createdAt: string;
}

export default function KitsTable({ kits }: { kits: Kit[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete kit "${name}"?`)) return;
    setDeleting(id);
    try {
      const res = await fetch("/api/kits", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Kit deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete kit");
    } finally {
      setDeleting(null);
    }
  }

  if (kits.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No kits found. Create your first kit to get started.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Name</th>
            <th className="px-4 py-3 text-left font-medium">Items</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {kits.map((kit) => (
            <tr key={kit.id} className="border-b hover:bg-muted/30">
              <td className="px-4 py-3">
                <Link href={`/kits/${kit.id}`} className="font-medium hover:underline">
                  {kit.name}
                </Link>
                {kit.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                    {kit.description}
                  </p>
                )}
              </td>
              <td className="px-4 py-3">{kit.items.length} items</td>
              <td className="px-4 py-3">
                <Badge variant={kit.isActive ? "default" : "secondary"}>
                  {kit.isActive ? "Active" : "Inactive"}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right space-x-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/kits/${kit.id}`}>View</Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(kit.id, kit.name)}
                  disabled={deleting === kit.id}
                >
                  {deleting === kit.id ? "..." : "Delete"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
