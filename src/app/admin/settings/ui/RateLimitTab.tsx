"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Trash2 } from "lucide-react";

interface RateLimitEntry {
  key: string;
  count: number;
  resetAt: string;
  isExpired: boolean;
}

interface RateLimitData {
  entries: RateLimitEntry[];
  total: number;
  activeCount: number;
}

export default function RateLimitTab() {
  const [data, setData] = useState<RateLimitData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/rate-limits");
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch rate limits", err);
      toast.error("Failed to fetch rate limits");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleReset = async (key: string) => {
    try {
      const res = await fetch("/api/admin/rate-limits", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (res.ok) {
        toast.success("Rate limit reset");
        fetchData();
      } else {
        toast.error("Failed to reset");
      }
    } catch (err) {
      console.error("Failed to reset rate limit", err);
      toast.error("Failed to reset rate limit");
    }
  };

  const parseKeyParts = (key: string) => {
    const parts = key.split(":");
    if (parts.length >= 2) {
      return { type: parts[0], identifier: parts.slice(1).join(":") };
    }
    return { type: "unknown", identifier: key };
  };

  const formatTimeRemaining = (resetAt: string) => {
    const diff = new Date(resetAt).getTime() - Date.now();
    if (diff <= 0) return "expired";
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>API Rate Limits</CardTitle>
            <CardDescription>
              Active rate limit entries — auto-refreshes every 30 seconds
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {data && (
            <div className="mb-4 flex gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total entries: </span>
                <span className="font-medium">{data.total}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Active: </span>
                <span className="font-medium">{data.activeCount}</span>
              </div>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Identifier</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Resets In</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.entries.map((entry) => {
                const { type, identifier } = parseKeyParts(entry.key);
                return (
                  <TableRow key={entry.key}>
                    <TableCell>
                      <Badge variant="outline">{type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate font-mono text-xs">
                      {identifier}
                    </TableCell>
                    <TableCell className="font-medium">{entry.count}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatTimeRemaining(entry.resetAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={entry.isExpired ? "secondary" : "default"}
                      >
                        {entry.isExpired ? "Expired" : "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReset(entry.key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!data || data.entries.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center">
                    <p className="text-muted-foreground">
                      No rate limit entries — the system is quiet
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configured Limits</CardTitle>
          <CardDescription>Default rate limiting configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Endpoint</TableHead>
                <TableHead>Max Requests</TableHead>
                <TableHead>Window</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Login</TableCell>
                <TableCell>5</TableCell>
                <TableCell>15 minutes</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>API (general)</TableCell>
                <TableCell>100</TableCell>
                <TableCell>1 minute</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Write operations</TableCell>
                <TableCell>30</TableCell>
                <TableCell>1 minute</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Password reset</TableCell>
                <TableCell>3</TableCell>
                <TableCell>1 hour</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
