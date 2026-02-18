"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

const COLUMN_WIDTHS = ["w-24", "w-32", "w-20", "w-40", "w-28", "w-36", "w-16", "w-24"];

export default function TableSkeleton({
  rows = 5,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="space-y-4">
      {/* Search / filter bar skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: columns }).map((_, col) => (
                <TableHead key={col}>
                  <Skeleton
                    className={`h-4 ${COLUMN_WIDTHS[col % COLUMN_WIDTHS.length]}`}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, row) => (
              <TableRow key={row}>
                {Array.from({ length: columns }).map((_, col) => (
                  <TableCell key={col}>
                    <Skeleton
                      className={`h-4 ${
                        COLUMN_WIDTHS[(col + row) % COLUMN_WIDTHS.length]
                      }`}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}
