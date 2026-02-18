"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ShieldCheck, ShieldAlert, ShieldX, Clock } from "lucide-react";

interface WarrantyAsset {
  id: string;
  name: string;
  tag: string;
  warrantyExpires: string;
  warrantyMonths: number | null;
  status: string;
  category: string;
}

interface WarrantyReportProps {
  warrantyAssets: WarrantyAsset[];
}

function getWarrantyStatus(expiresStr: string): "expired" | "expiring-soon" | "active" {
  const now = new Date();
  const expires = new Date(expiresStr);
  if (expires < now) return "expired";
  const diffMs = expires.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 90) return "expiring-soon";
  return "active";
}

function getDaysDiff(expiresStr: string): number {
  const now = new Date();
  const expires = new Date(expiresStr);
  return (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
}

export default function WarrantyReport({ warrantyAssets }: WarrantyReportProps) {
  const sortedAssets = useMemo(
    () =>
      [...warrantyAssets].sort(
        (a, b) =>
          new Date(a.warrantyExpires).getTime() -
          new Date(b.warrantyExpires).getTime()
      ),
    [warrantyAssets]
  );

  const counts = useMemo(() => {
    let expired = 0;
    let expiring30 = 0;
    let expiring90 = 0;
    let active = 0;

    for (const asset of warrantyAssets) {
      const days = getDaysDiff(asset.warrantyExpires);
      if (days < 0) {
        expired++;
      } else if (days < 30) {
        expiring30++;
      } else if (days < 90) {
        expiring90++;
      } else {
        active++;
      }
    }

    return { expired, expiring30, expiring90, active };
  }, [warrantyAssets]);

  const chartData = useMemo(() => {
    const now = new Date();
    const months: { label: string; count: number; year: number; month: number }[] = [];

    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push({
        label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        count: 0,
        year: d.getFullYear(),
        month: d.getMonth(),
      });
    }

    for (const asset of warrantyAssets) {
      const expires = new Date(asset.warrantyExpires);
      if (expires < now) continue;
      for (const m of months) {
        if (expires.getFullYear() === m.year && expires.getMonth() === m.month) {
          m.count++;
          break;
        }
      }
    }

    return months.map(({ label, count }) => ({ month: label, count }));
  }, [warrantyAssets]);

  const getBarColor = (entry: { month: string; count: number }, index: number) => {
    if (index < 1) return "#ef4444";
    if (index < 3) return "#f59e0b";
    return "#22c55e";
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Total Warranties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{warrantyAssets.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShieldX className="h-4 w-4 text-red-500" />
              Expired
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{counts.expired}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Expiring &lt; 30d
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{counts.expiring30}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-orange-500" />
              Expiring &lt; 90d
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{counts.expiring90}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{counts.active}</div>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Warranty Expirations by Month (Next 12 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Expiring">
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry, index)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Warranty Details</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedAssets.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No assets with warranty information found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Asset Name</th>
                    <th className="text-left py-3 px-2 font-medium">Tag</th>
                    <th className="text-left py-3 px-2 font-medium">Category</th>
                    <th className="text-left py-3 px-2 font-medium">Duration</th>
                    <th className="text-left py-3 px-2 font-medium">Expires</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAssets.map((asset) => {
                    const warrantyStatus = getWarrantyStatus(asset.warrantyExpires);
                    return (
                      <tr key={asset.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-2">
                          <Link
                            href={`/assets/${asset.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {asset.name}
                          </Link>
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">
                          {asset.tag}
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">
                          {asset.category}
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">
                          {asset.warrantyMonths != null
                            ? `${asset.warrantyMonths} months`
                            : "--"}
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">
                          {new Date(asset.warrantyExpires).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </td>
                        <td className="py-3 px-2">
                          {warrantyStatus === "expired" && (
                            <Badge
                              variant="destructive"
                            >
                              Expired
                            </Badge>
                          )}
                          {warrantyStatus === "expiring-soon" && (
                            <Badge
                              className="bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-100"
                            >
                              Expiring Soon
                            </Badge>
                          )}
                          {warrantyStatus === "active" && (
                            <Badge
                              className="bg-green-100 text-green-800 border-green-300 hover:bg-green-100"
                            >
                              Active
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
