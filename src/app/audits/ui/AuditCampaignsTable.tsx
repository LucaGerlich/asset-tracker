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

interface Campaign {
  id: string;
  name: string;
  status: string;
  scopeType: string;
  dueDate?: string | Date | null;
  createdAt: string | Date;
  creator: { userid: string; firstname: string; lastname: string };
  _count: { entries: number; auditors: number };
}

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  active: "default",
  completed: "outline",
  cancelled: "destructive",
};

export default function AuditCampaignsTable({
  campaigns,
}: {
  campaigns: Campaign[];
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete campaign "${name}"?`)) return;
    setDeleting(id);
    try {
      const res = await fetch("/api/audits", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Campaign deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete campaign");
    } finally {
      setDeleting(null);
    }
  }

  if (campaigns.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center">
        No audit campaigns found. Create your first campaign to get started.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>Assets</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Created By</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Link
                  href={`/audits/${c.id}`}
                  className="font-medium hover:underline"
                >
                  {c.name}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant[c.status] || "secondary"}>
                  {c.status}
                </Badge>
              </TableCell>
              <TableCell className="capitalize">{c.scopeType}</TableCell>
              <TableCell>{c._count.entries}</TableCell>
              <TableCell>
                {c.dueDate ? new Date(c.dueDate).toLocaleDateString() : "—"}
              </TableCell>
              <TableCell>
                {c.creator.firstname} {c.creator.lastname}
              </TableCell>
              <TableCell className="space-x-2 text-right">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/audits/${c.id}`}>View</Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(c.id, c.name)}
                  disabled={deleting === c.id}
                >
                  {deleting === c.id ? "..." : "Delete"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
