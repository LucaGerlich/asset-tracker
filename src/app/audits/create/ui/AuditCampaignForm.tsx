"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function AuditCampaignForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [scopeType, setScopeType] = useState("all");
  const [scopeId, setScopeId] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const body: any = {
        name,
        description: description || undefined,
        dueDate: dueDate || undefined,
        scopeType,
        scopeId: scopeId || undefined,
      };

      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create campaign");
      }

      const campaign = await res.json();
      toast.success("Campaign created");
      router.push(`/audits/${campaign.id}`);
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
        <Label htmlFor="name">Campaign Name *</Label>
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

      <div className="space-y-2">
        <Label htmlFor="dueDate">Due Date</Label>
        <Input
          id="dueDate"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="scopeType">Scope</Label>
        <select
          id="scopeType"
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={scopeType}
          onChange={(e) => setScopeType(e.target.value)}
        >
          <option value="all">All Assets</option>
          <option value="location">By Location</option>
          <option value="category">By Category</option>
        </select>
      </div>

      {scopeType !== "all" && (
        <div className="space-y-2">
          <Label htmlFor="scopeId">
            {scopeType === "location" ? "Location ID" : "Category ID"}
          </Label>
          <Input
            id="scopeId"
            value={scopeId}
            onChange={(e) => setScopeId(e.target.value)}
            placeholder="UUID"
          />
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Campaign"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
