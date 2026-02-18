"use client";

import React from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

export interface ResponsiveTableColumn {
  key: string;
  label: string;
  primary?: boolean;
}

interface ResponsiveTableProps {
  columns: ResponsiveTableColumn[];
  data: Record<string, unknown>[];
  onRowClick?: (row: Record<string, unknown>) => void;
}

export default function ResponsiveTable({
  columns,
  data,
  onRowClick,
}: ResponsiveTableProps) {
  const primaryColumn = columns.find((col) => col.primary) || columns[0];
  const secondaryColumns = columns.filter(
    (col) => col.key !== primaryColumn?.key
  );

  if (!data || data.length === 0) {
    return (
      <div className="w-full rounded-md border p-8 text-center">
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: Stacked card view */}
      <div className="block md:hidden space-y-3">
        {data.map((row, index) => (
          <Card
            key={(row.id as string | number) ?? index}
            className={onRowClick ? "cursor-pointer hover-lift active:scale-[0.98] transition-transform" : ""}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            <CardContent className="px-4 py-3">
              {primaryColumn && (
                <p className="font-semibold text-sm mb-2 text-foreground">
                  {String(row[primaryColumn.key] ?? "")}
                </p>
              )}
              <div className="space-y-1.5">
                {secondaryColumns.map((col) => (
                  <div
                    key={col.key}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="text-muted-foreground shrink-0">
                      {col.label}
                    </span>
                    <span className="text-right truncate">
                      {String(row[col.key] ?? "-")}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop: Standard table view */}
      <div className="hidden md:block overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow
                key={(row.id as string | number) ?? index}
                className={
                  onRowClick
                    ? "cursor-pointer hover:bg-accent transition-colors"
                    : ""
                }
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    {String(row[col.key] ?? "-")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
