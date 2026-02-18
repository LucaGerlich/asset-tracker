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
} from "recharts";
import { TrendingDown, DollarSign, BarChart3, Package, CheckCircle } from "lucide-react";
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
    return (
      <Badge variant="destructive">
        Fully Depreciated
      </Badge>
    );
  }
  if (asset.percentDepreciated > 75) {
    return (
      <Badge className="bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-100">
        {asset.percentDepreciated.toFixed(0)}% Depreciated
      </Badge>
    );
  }
  if (asset.percentDepreciated > 50) {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-100">
        {asset.percentDepreciated.toFixed(0)}% Depreciated
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-100 text-green-800 border-green-300 hover:bg-green-100">
      {asset.percentDepreciated.toFixed(0)}% Depreciated
    </Badge>
  );
}

export default function DepreciationReport({ depreciationAssets }: DepreciationReportProps) {
  const totalOriginalValue = useMemo(
    () => depreciationAssets.reduce((sum, a) => sum + a.purchasePrice, 0),
    [depreciationAssets]
  );

  const totalCurrentValue = useMemo(
    () => depreciationAssets.reduce((sum, a) => sum + a.currentValue, 0),
    [depreciationAssets]
  );

  const totalDepreciation = useMemo(
    () => depreciationAssets.reduce((sum, a) => sum + a.accumulatedDepreciation, 0),
    [depreciationAssets]
  );

  const fullyDepreciatedCount = useMemo(
    () => depreciationAssets.filter((a) => a.isFullyDepreciated).length,
    [depreciationAssets]
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
        (a, b) => b.percentDepreciated - a.percentDepreciated
      ),
    [depreciationAssets]
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Assets Tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{depreciationAssets.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Original Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalOriginalValue)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
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
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
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
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-red-500" />
              Fully Depreciated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{fullyDepreciatedCount}</div>
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
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar dataKey="originalValue" name="Original Value" fill="#8884d8" />
                <Bar dataKey="currentValue" name="Current Value" fill="#82ca9d" />
                <Bar dataKey="depreciation" name="Depreciation" fill="#ff8042" />
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Asset Name</th>
                    <th className="text-left py-3 px-2 font-medium">Tag</th>
                    <th className="text-left py-3 px-2 font-medium">Category</th>
                    <th className="text-left py-3 px-2 font-medium">Method</th>
                    <th className="text-right py-3 px-2 font-medium">Purchase Price</th>
                    <th className="text-right py-3 px-2 font-medium">Current Value</th>
                    <th className="text-right py-3 px-2 font-medium">Depreciation %</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAssets.map((asset) => (
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
                        {getMethodDisplayName(asset.method)}
                      </td>
                      <td className="py-3 px-2 text-right text-muted-foreground">
                        {formatCurrency(asset.purchasePrice)}
                      </td>
                      <td className="py-3 px-2 text-right font-medium">
                        {formatCurrency(asset.currentValue)}
                      </td>
                      <td className="py-3 px-2 text-right text-muted-foreground">
                        {asset.percentDepreciated.toFixed(1)}%
                      </td>
                      <td className="py-3 px-2">
                        {getStatusBadge(asset)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
