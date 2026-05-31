"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  Wrench,
  TrendingDown,
  BarChart3,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import type { TCOCategoryBreakdown, TCOSummary } from "@/lib/tco";

type SortField = keyof Pick<
  TCOCategoryBreakdown,
  | "categoryName"
  | "assetCount"
  | "purchaseCost"
  | "maintenanceCost"
  | "depreciationLoss"
  | "currentValue"
  | "totalCostOfOwnership"
>;

type SortDirection = "asc" | "desc";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

interface SummaryCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
}

function SummaryCard({ title, value, icon }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-5 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

interface SortableHeaderProps {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  className?: string;
}

function SortableHeader({
  label,
  field,
  sortField,
  sortDirection,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = sortField === field;
  return (
    <TableHead
      className={`cursor-pointer select-none ${className ?? ""}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive &&
          (sortDirection === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          ))}
      </span>
    </TableHead>
  );
}

const CHART_COLORS = {
  purchase: "#3b82f6", // blue-500
  maintenance: "#f97316", // orange-500
  depreciation: "#ef4444", // red-500
} as const;

export default function TCODashboard() {
  const [data, setData] = useState<TCOSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("totalCostOfOwnership");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/dashboard/tco");
        if (!res.ok) {
          throw new Error(`Failed to fetch TCO data (${res.status})`);
        }
        const json: TCOSummary = await res.json();
        setData(json);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to load TCO data";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleSort = useCallback(
    (field: SortField) => {
      if (field === sortField) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("desc");
      }
    },
    [sortField],
  );

  const sortedCategories = useMemo(() => {
    if (!data) return [];
    const sorted = [...data.byCategory];
    sorted.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
    });
    return sorted;
  }, [data, sortField, sortDirection]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.byCategory.map((cat) => ({
      name:
        cat.categoryName.length > 16
          ? `${cat.categoryName.slice(0, 14)}...`
          : cat.categoryName,
      "Purchase Cost": cat.purchaseCost,
      "Maintenance Cost": cat.maintenanceCost,
      "Depreciation Loss": cat.depreciationLoss,
    }));
  }, [data]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">
          No TCO data available. Check that assets have purchase prices
          configured.
        </p>
      </div>
    );
  }

  const headerProps = {
    sortField,
    sortDirection,
    onSort: handleSort,
  } as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          TCO Analysis
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Total Cost of Ownership breakdown across asset categories
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total Purchase Cost"
          value={formatCurrency(data.totalPurchaseCost)}
          icon={<DollarSign className="text-muted-foreground h-5 w-5" />}
        />
        <SummaryCard
          title="Total Maintenance Cost"
          value={formatCurrency(data.totalMaintenanceCost)}
          icon={<Wrench className="text-muted-foreground h-5 w-5" />}
        />
        <SummaryCard
          title="Depreciation Loss"
          value={formatCurrency(data.totalDepreciationLoss)}
          icon={<TrendingDown className="text-muted-foreground h-5 w-5" />}
        />
        <SummaryCard
          title="Current Fleet Value"
          value={formatCurrency(data.totalCurrentValue)}
          icon={<BarChart3 className="text-muted-foreground h-5 w-5" />}
        />
      </div>

      {/* Stacked bar chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Cost Breakdown by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                  }
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                    color: "hsl(var(--card-foreground))",
                  }}
                />
                <Legend />
                <Bar
                  dataKey="Purchase Cost"
                  stackId="cost"
                  fill={CHART_COLORS.purchase}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="Maintenance Cost"
                  stackId="cost"
                  fill={CHART_COLORS.maintenance}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="Depreciation Loss"
                  stackId="cost"
                  fill={CHART_COLORS.depreciation}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Category breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader
                  label="Category"
                  field="categoryName"
                  {...headerProps}
                />
                <SortableHeader
                  label="Assets"
                  field="assetCount"
                  className="text-right"
                  {...headerProps}
                />
                <SortableHeader
                  label="Purchase Cost"
                  field="purchaseCost"
                  className="text-right"
                  {...headerProps}
                />
                <SortableHeader
                  label="Maintenance"
                  field="maintenanceCost"
                  className="text-right"
                  {...headerProps}
                />
                <SortableHeader
                  label="Depreciation"
                  field="depreciationLoss"
                  className="text-right"
                  {...headerProps}
                />
                <SortableHeader
                  label="Current Value"
                  field="currentValue"
                  className="text-right"
                  {...headerProps}
                />
                <SortableHeader
                  label="Total TCO"
                  field="totalCostOfOwnership"
                  className="text-right"
                  {...headerProps}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCategories.map((cat) => (
                <TableRow key={cat.categoryId ?? "__uncategorized"}>
                  <TableCell className="font-medium">
                    {cat.categoryName}
                  </TableCell>
                  <TableCell className="text-right">{cat.assetCount}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(cat.purchaseCost)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(cat.maintenanceCost)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(cat.depreciationLoss)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(cat.currentValue)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(cat.totalCostOfOwnership)}
                  </TableCell>
                </TableRow>
              ))}
              {sortedCategories.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-muted-foreground text-center"
                  >
                    No category data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
