"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AuditCampaignActions({
  campaignId,
  status,
}: {
  campaignId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleActivate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/audits/${campaignId}/activate`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to activate");
      }
      const data = await res.json();
      toast.success(`Campaign activated with ${data.assetsCount} assets`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    if (!confirm("Complete this audit campaign?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/audits/${campaignId}/complete`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to complete");
      }
      toast.success("Campaign completed");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      {status === "draft" && (
        <Button onClick={handleActivate} disabled={loading}>
          {loading ? "..." : "Activate"}
        </Button>
      )}
      {status === "active" && (
        <Button onClick={handleComplete} disabled={loading} variant="outline">
          {loading ? "..." : "Complete"}
        </Button>
      )}
    </div>
  );
}
