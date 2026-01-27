"use client"

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { ReactNode } from "react"

interface Column {
  key: string
  label: string
}

interface ResponsiveTableProps<T> {
  columns: Column[]
  data: T[]
  renderCell: (item: T, key: string) => ReactNode
  mobileCardView?: boolean
  minWidth?: string
  keyExtractor?: (item: T) => string | number
  emptyMessage?: string
}

export function ResponsiveTable<T>({
  columns,
  data,
  renderCell,
  mobileCardView = false,
  minWidth = "800px",
  keyExtractor = (item) => (item as Record<string, unknown>).id as string | number,
  emptyMessage = "No data available"
}: ResponsiveTableProps<T>) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full rounded-md border p-8 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  if (mobileCardView) {
    return (
      <>
        {/* Mobile: Card view */}
        <div className="block lg:hidden space-y-4">
          {data.map((item) => (
            <Card key={keyExtractor(item)}>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  {columns.map((col) => (
                    <div key={col.key} className="flex justify-between gap-4">
                      <span className="font-medium text-muted-foreground text-sm">
                        {col.label}:
                      </span>
                      <span className="text-sm text-right">{renderCell(item, col.key)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Desktop: Table view */}
        <div className="hidden lg:block overflow-x-auto rounded-md border">
          <Table style={{ minWidth }}>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={keyExtractor(item)}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      {renderCell(item, col.key)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </>
    )
  }

  // Scroll-only mode (no card view)
  return (
    <div className="w-full overflow-x-auto rounded-md border">
      <Table style={{ minWidth }}>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key}>{col.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={keyExtractor(item)}>
              {columns.map((col) => (
                <TableCell key={col.key}>
                  {renderCell(item, col.key)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
