import React from "react";
import {
  calculateDepreciation,
  formatCurrency,
  getDepreciationSchedule,
  getMethodDisplayName,
  type DepreciationMethod,
} from "@/lib/depreciation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface AssetDepreciationPanelProps {
  asset: {
    assetname: string;
    purchaseprice: number | null;
    purchasedate: Date | null;
    assetcategorytypeid: string | null;
  };
  categoryName: string | null;
  settings: {
    method: string;
    usefulLifeYears: number;
    salvagePercent: unknown;
  } | null;
}

const SUPPORTED_METHODS: DepreciationMethod[] = [
  "straight_line",
  "declining_balance",
  "sum_of_years",
];

export default function AssetDepreciationPanel({
  asset,
  categoryName,
  settings,
}: AssetDepreciationPanelProps) {
  if (!asset.assetcategorytypeid) {
    return (
      <section className="rounded-lg border border-default-200 p-4">
        <h2 className="text-sm font-semibold text-foreground-600">Depreciation</h2>
        <p className="text-sm text-foreground-500 mt-2">
          Assign an asset category to enable depreciation tracking.
        </p>
      </section>
    );
  }

  if (!settings) {
    return (
      <section className="rounded-lg border border-default-200 p-4">
        <h2 className="text-sm font-semibold text-foreground-600">Depreciation</h2>
        <p className="text-sm text-foreground-500 mt-2">
          No depreciation settings found for {categoryName || "this category"}. Configure them in Admin &gt;
          Settings &gt; Depreciation.
        </p>
      </section>
    );
  }

  if (asset.purchaseprice == null || !asset.purchasedate) {
    return (
      <section className="rounded-lg border border-default-200 p-4">
        <h2 className="text-sm font-semibold text-foreground-600">Depreciation</h2>
        <p className="text-sm text-foreground-500 mt-2">
          Add a purchase price and purchase date to calculate depreciation.
        </p>
      </section>
    );
  }

  const salvagePercent = Number(settings.salvagePercent);
  if (!Number.isFinite(salvagePercent)) {
    return (
      <section className="rounded-lg border border-default-200 p-4">
        <h2 className="text-sm font-semibold text-foreground-600">Depreciation</h2>
        <p className="text-sm text-foreground-500 mt-2">
          Depreciation settings are invalid. Please check the salvage percentage value.
        </p>
      </section>
    );
  }

  const method = settings.method as DepreciationMethod;
  if (!SUPPORTED_METHODS.includes(method)) {
    return (
      <section className="rounded-lg border border-default-200 p-4">
        <h2 className="text-sm font-semibold text-foreground-600">Depreciation</h2>
        <p className="text-sm text-foreground-500 mt-2">
          Unsupported depreciation method: {settings.method}.
        </p>
      </section>
    );
  }

  const params = {
    purchasePrice: asset.purchaseprice,
    purchaseDate: asset.purchasedate,
    usefulLifeYears: settings.usefulLifeYears,
    salvagePercent,
    method,
  };

  const result = calculateDepreciation(params);
  const schedule = getDepreciationSchedule(params);
  const percent = Math.round(result.percentDepreciated);

  return (
    <section className="rounded-lg border border-default-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground-600">Depreciation</h2>
          <p className="text-xs text-foreground-500 mt-1">
            {getMethodDisplayName(method)} | {settings.usefulLifeYears} year life | {salvagePercent}% salvage
          </p>
        </div>
        {result.isFullyDepreciated ? (
          <Badge variant="secondary">Fully depreciated</Badge>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-md border border-default-200 p-3">
          <p className="text-xs text-foreground-500">Current Value</p>
          <p className="text-lg font-semibold">{formatCurrency(result.currentValue)}</p>
        </div>
        <div className="rounded-md border border-default-200 p-3">
          <p className="text-xs text-foreground-500">Accumulated Depreciation</p>
          <p className="text-lg font-semibold">{formatCurrency(result.accumulatedDepreciation)}</p>
        </div>
        <div className="rounded-md border border-default-200 p-3">
          <p className="text-xs text-foreground-500">Salvage Value</p>
          <p className="text-lg font-semibold">{formatCurrency(result.salvageValue)}</p>
        </div>
        <div className="rounded-md border border-default-200 p-3">
          <p className="text-xs text-foreground-500">Years Owned</p>
          <p className="text-lg font-semibold">{result.yearsOwned.toFixed(1)}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-foreground-500">
          <span>Depreciated {percent}%</span>
          <span>{formatCurrency(result.totalDepreciation)} total</span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-default-200">
          <div
            className="h-2 rounded-full bg-primary"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-foreground-600 mb-2">Schedule</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Year</TableHead>
              <TableHead>Start Value</TableHead>
              <TableHead>Depreciation</TableHead>
              <TableHead>End Value</TableHead>
              <TableHead>Accumulated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedule.map((row) => (
              <TableRow key={row.year}>
                <TableCell>{row.year}</TableCell>
                <TableCell>{formatCurrency(row.startValue)}</TableCell>
                <TableCell>{formatCurrency(row.depreciation)}</TableCell>
                <TableCell>{formatCurrency(row.endValue)}</TableCell>
                <TableCell>{formatCurrency(row.accumulatedDepreciation)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
