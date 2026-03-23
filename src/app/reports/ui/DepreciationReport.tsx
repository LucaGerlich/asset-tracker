"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingDown,
  DollarSign,
  BarChart3,
  Package,
  CheckCircle,
} from "lucide-react";
import { DepreciationMethod, getMethodDisplayName } from "@/lib/depreciation";

interface DepreciationAsset {
  id: string;
  name: string;
  tag: string;
  category: string;
  purchasePrice: number;
  purchaseDate: string;
  method: DepreciationMethod;
  usefulLifeYears: number;
  salvagePercent: number;
  currentValue: number;
  accumulatedDepreciation: number;
  percentDepreciated: number;
  isFullyDepreciated: boolean;
}

interface DepreciationReportProps {
  depreciationAssets: DepreciationAsset[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getStatusBadge(asset: DepreciationAsset) {
  if (asset.isFullyDepreciated) {
    return <Badge variant="destructive">Fully Depreciated</Badge>;
  }
  if (asset.percentDepreciated > 75) {
    return (
      <Badge className="border-orange-300 bg-orange-100 text-orange-800 hover:bg-orange-100">
        {asset.percentDepreciated.toFixed(0)}% Depreciated
      </Badge>
    );
  }
  if (asset.percentDepreciated > 50) {
    return (
      <Badge className="border-yellow-300 bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
        {asset.percentDepreciated.toFixed(0)}% Depreciated
      </Badge>
    );
  }
  return (
    <Badge className="border-green-300 bg-green-100 text-green-800 hover:bg-green-100">
      {asset.percentDepreciated.toFixed(0)}% Depreciated
    </Badge>
  );
}

export default function DepreciationReport({
  depreciationAssets,
}: DepreciationReportProps) {
  const totalOriginalValue = useMemo(
    () => depreciationAssets.reduce((sum, a) => sum + a.purchasePrice, 0),
    [depreciationAssets],
  );

  const totalCurrentValue = useMemo(
    () => depreciationAssets.reduce((sum, a) => sum + a.currentValue, 0),
    [depreciationAssets],
  );

  const totalDepreciation = useMemo(
    () =>
      depreciationAssets.reduce((sum, a) => sum + a.accumulatedDepreciation, 0),
    [depreciationAssets],
  );

  const fullyDepreciatedCount = useMemo(
    () => depreciationAssets.filter((a) => a.isFullyDepreciated).length,
    [depreciationAssets],
  );

  const depreciationByCategory = useMemo(() => {
    const categoryMap = new Map<
      string,
      { originalValue: number; currentValue: number; depreciation: number }
    >();

    for (const asset of depreciationAssets) {
      const existing = categoryMap.get(asset.category) || {
        originalValue: 0,
        currentValue: 0,
        depreciation: 0,
      };
      categoryMap.set(asset.category, {
        originalValue: existing.originalValue + asset.purchasePrice,
        currentValue: existing.currentValue + asset.currentValue,
        depreciation: existing.depreciation + asset.accumulatedDepreciation,
      });
    }

    return Array.from(categoryMap.entries()).map(([category, values]) => ({
      category,
      originalValue: Math.round(values.originalValue),
      currentValue: Math.round(values.currentValue),
      depreciation: Math.round(values.depreciation),
    }));
  }, [depreciationAssets]);

  const sortedAssets = useMemo(
    () =>
      [...depreciationAssets].sort(
        (a, b) => b.percentDepreciated - a.percentDepreciated,
      ),
    [depreciationAssets],
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <Package className="h-4 w-4" />
              Assets Tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {depreciationAssets.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4" />
              Total Original Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalOriginalValue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              Total Current Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(totalCurrentValue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <TrendingDown className="h-4 w-4 text-orange-500" />
              Total Depreciation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(totalDepreciation)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <CheckCircle className="h-4 w-4 text-red-500" />
              Fully Depreciated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {fullyDepreciatedCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart - Depreciation by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Depreciation by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {depreciationByCategory.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No depreciation data available.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={depreciationByCategory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar
                  dataKey="originalValue"
                  name="Original Value"
                  fill="#8884d8"
                />
                <Bar
                  dataKey="currentValue"
                  name="Current Value"
                  fill="#82ca9d"
                />
                <Bar
                  dataKey="depreciation"
                  name="Depreciation"
                  fill="#ff8042"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Asset Table */}
      <Card>
        <CardHeader>
          <CardTitle>Depreciation Details</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedAssets.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No assets with depreciation settings found. Configure depreciation
              settings for your asset categories in the admin settings.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Name</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Purchase Price</TableHead>
                  <TableHead className="text-right">Current Value</TableHead>
                  <TableHead className="text-right">Depreciation %</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAssets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <Link
                        href={`/assets/${asset.id}`}
                        className="text-primary font-medium hover:underline"
                      >
                        {asset.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {asset.tag}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {asset.category}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getMethodDisplayName(asset.method)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right">
                      {formatCurrency(asset.purchasePrice)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(asset.currentValue)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right">
                      {asset.percentDepreciated.toFixed(1)}%
                    </TableCell>
                    <TableCell>{getStatusBadge(asset)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
