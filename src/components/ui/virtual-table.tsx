"use client";

import React, { useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface VirtualTableColumn {
  key: string;
  label: string;
  className?: string;
}

interface VirtualTableProps<T> {
  /** Column definitions with key, label, and optional className */
  columns: VirtualTableColumn[];
  /** Data rows to render */
  data: T[];
  /** Render function for each cell, given the row item and column key */
  renderCell: (item: T, columnKey: string) => React.ReactNode;
  /** Extract a unique key from each row item */
  keyExtractor?: (item: T) => string | number;
  /** Estimated height of each row in pixels (default: 48) */
  estimatedRowHeight?: number;
  /** Maximum height of the scrollable container in pixels (default: 600) */
  maxHeight?: number;
  /** Overscan – number of extra rows rendered beyond the visible area (default: 10) */
  overscan?: number;
  /** Message to show when no data is available */
  emptyMessage?: string;
  /** Optional header row prepended to each data row (e.g. checkbox column) */
  renderRowPrefix?: (item: T) => React.ReactNode;
  /** Optional header cell for the prefix column */
  headerPrefix?: React.ReactNode;
  /** Additional className on the outer container */
  className?: string;
  /** Minimum table width for horizontal scrolling (e.g. "800px") */
  minWidth?: string;
}

/**
 * VirtualTable – a virtualized table component that only renders visible rows.
 * Built on @tanstack/react-virtual for smooth scrolling with 1000+ rows.
 * Supports dynamic row heights via the virtualizer's measureElement callback.
 */
export function VirtualTable<T>({
  columns,
  data,
  renderCell,
  keyExtractor = (item) =>
    (item as Record<string, unknown>).id as string | number,
  estimatedRowHeight = 48,
  maxHeight = 600,
  overscan = 10,
  emptyMessage = "No data available",
  renderRowPrefix,
  headerPrefix,
  className,
  minWidth,
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan,
  });

  const measureRef = useCallback(
    (node: HTMLTableRowElement | null) => {
      if (node) {
        const index = Number(node.dataset.index);
        if (!isNaN(index)) {
          virtualizer.measureElement(node);
        }
      }
    },
    [virtualizer],
  );

  if (!data || data.length === 0) {
    return (
      <div className="w-full rounded-md border p-8 text-center">
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      ref={parentRef}
      className={cn("w-full overflow-auto rounded-md border", className)}
      style={{ maxHeight }}
    >
      <Table style={{ minWidth }}>
        <TableHeader className="bg-background sticky top-0 z-10">
          <TableRow>
            {headerPrefix !== undefined && headerPrefix}
            {columns.map((col) => (
              <TableHead key={col.key} className={col.className}>
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Top spacer to position visible rows correctly */}
          {virtualItems.length > 0 && (
            <tr>
              <td
                colSpan={columns.length + (headerPrefix !== undefined ? 1 : 0)}
                style={{ height: virtualItems[0].start, padding: 0 }}
              />
            </tr>
          )}
          {virtualItems.map((virtualRow) => {
            const item = data[virtualRow.index];
            const key = keyExtractor(item);
            return (
              <TableRow
                key={key}
                data-index={virtualRow.index}
                ref={measureRef}
              >
                {renderRowPrefix && renderRowPrefix(item)}
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    {renderCell(item, col.key)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
          {/* Bottom spacer */}
          {virtualItems.length > 0 && (
            <tr>
              <td
                colSpan={columns.length + (headerPrefix !== undefined ? 1 : 0)}
                style={{
                  height: totalSize - virtualItems[virtualItems.length - 1].end,
                  padding: 0,
                }}
              />
            </tr>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
