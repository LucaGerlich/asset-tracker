"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  createdAt: string | Date;
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
      <div className="text-muted-foreground py-12 text-center">
        No kits found. Create your first kit to get started.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Name</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {kits.map((kit) => (
            <TableRow key={kit.id}>
              <TableCell>
                <Link
                  href={`/kits/${kit.id}`}
                  className="font-medium hover:underline"
                >
                  {kit.name}
                </Link>
                {kit.description && (
                  <p className="text-muted-foreground mt-0.5 max-w-xs truncate text-xs">
                    {kit.description}
                  </p>
                )}
              </TableCell>
              <TableCell>{kit.items.length} items</TableCell>
              <TableCell>
                <Badge variant={kit.isActive ? "default" : "secondary"}>
                  {kit.isActive ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell className="space-x-2 text-right">
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
