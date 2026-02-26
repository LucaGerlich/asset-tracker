"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Campaign {
  id: string;
  name: string;
  status: string;
  scopeType: string;
  dueDate?: string | null;
  createdAt: string;
  creator: { userid: string; firstname: string; lastname: string };
  _count: { entries: number; auditors: number };
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  active: "default",
  completed: "outline",
  cancelled: "destructive",
};

export default function AuditCampaignsTable({ campaigns }: { campaigns: Campaign[] }) {
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
      <div className="text-center py-12 text-muted-foreground">
        No audit campaigns found. Create your first campaign to get started.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Name</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-left font-medium">Scope</th>
            <th className="px-4 py-3 text-left font-medium">Assets</th>
            <th className="px-4 py-3 text-left font-medium">Due Date</th>
            <th className="px-4 py-3 text-left font-medium">Created By</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id} className="border-b hover:bg-muted/30">
              <td className="px-4 py-3">
                <Link href={`/audits/${c.id}`} className="font-medium hover:underline">
                  {c.name}
                </Link>
              </td>
              <td className="px-4 py-3">
                <Badge variant={statusVariant[c.status] || "secondary"}>
                  {c.status}
                </Badge>
              </td>
              <td className="px-4 py-3 capitalize">{c.scopeType}</td>
              <td className="px-4 py-3">{c._count.entries}</td>
              <td className="px-4 py-3">
                {c.dueDate
                  ? new Date(c.dueDate).toLocaleDateString()
                  : "—"}
              </td>
              <td className="px-4 py-3">
                {c.creator.firstname} {c.creator.lastname}
              </td>
              <td className="px-4 py-3 text-right space-x-2">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
