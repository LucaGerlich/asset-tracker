"use client";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReactNode, useMemo } from "react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { Columns3, X } from "lucide-react";

interface Column {
  key: string;
  label: string;
  hideable?: boolean;
}

interface ResponsiveTableProps<T> {
  columns: Column[];
  data: T[];
  renderCell: (item: T, key: string) => ReactNode;
  mobileCardView?: boolean;
  minWidth?: string;
  keyExtractor?: (item: T) => string | number;
  emptyMessage?: string;
  // Column visibility
  storageKey?: string;
  defaultVisibleColumns?: string[];
  // Selection
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  bulkActions?: ReactNode;
}

export function ResponsiveTable<T>({
  columns,
  data,
  renderCell,
  mobileCardView = false,
  minWidth = "800px",
  keyExtractor = (item) =>
    (item as Record<string, unknown>).id as string | number,
  emptyMessage = "No data available",
  storageKey,
  defaultVisibleColumns,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  bulkActions,
}: ResponsiveTableProps<T>) {
  const allColumnKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const [persistedColumns, setPersistedColumns] = usePersistentState<string[]>(
    storageKey || "__unused",
    defaultVisibleColumns || allColumnKeys,
  );

  const visibleColumnKeys = storageKey
    ? new Set(persistedColumns)
    : new Set(allColumnKeys);

  const visibleColumns = useMemo(() => {
    if (!storageKey) return columns;
    return columns.filter((col) => visibleColumnKeys.has(col.key));
  }, [columns, storageKey, visibleColumnKeys]);

  const handleColumnToggle = (columnKey: string) => {
    const current = new Set(persistedColumns);
    if (current.has(columnKey)) {
      current.delete(columnKey);
    } else {
      current.add(columnKey);
    }
    setPersistedColumns(Array.from(current));
  };

  // Selection helpers
  const allPageKeys = useMemo(
    () => data.map((item) => String(keyExtractor(item))),
    [data, keyExtractor],
  );
  const allSelected =
    selectable &&
    selectedKeys &&
    allPageKeys.length > 0 &&
    allPageKeys.every((k) => selectedKeys.has(k));
  const someSelected =
    selectable &&
    selectedKeys &&
    !allSelected &&
    allPageKeys.some((k) => selectedKeys.has(k));

  const handleSelectAll = () => {
    if (!onSelectionChange || !selectedKeys) return;
    if (allSelected) {
      const next = new Set(selectedKeys);
      allPageKeys.forEach((k) => next.delete(k));
      onSelectionChange(next);
    } else {
      const next = new Set(selectedKeys);
      allPageKeys.forEach((k) => next.add(k));
      onSelectionChange(next);
    }
  };

  const handleSelectRow = (key: string) => {
    if (!onSelectionChange || !selectedKeys) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onSelectionChange(next);
  };

  const columnToggleUI = storageKey ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 className="mr-2 h-4 w-4" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {columns.map((col) => {
          if (col.hideable === false) return null;
          return (
            <DropdownMenuItem
              key={col.key}
              onSelect={(e) => {
                e.preventDefault();
                handleColumnToggle(col.key);
              }}
            >
              <Checkbox
                checked={visibleColumnKeys.has(col.key)}
                onCheckedChange={() => handleColumnToggle(col.key)}
                className="mr-2"
              />
              {col.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const bulkBar =
    selectable && selectedKeys && selectedKeys.size > 0 ? (
      <div className="bg-muted/50 flex items-center gap-3 rounded-md border px-4 py-2">
        <span className="text-sm font-medium">
          {selectedKeys.size} selected
        </span>
        {bulkActions}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSelectionChange?.(new Set())}
        >
          <X className="mr-1 h-3 w-3" />
          Clear
        </Button>
      </div>
    ) : null;

  const toolbarContent =
    columnToggleUI || bulkBar ? (
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {bulkBar}
        <div className="ml-auto">{columnToggleUI}</div>
      </div>
    ) : null;

  if (!data || data.length === 0) {
    return (
      <>
        {toolbarContent}
        <div className="w-full rounded-md border p-8 text-center">
          <p className="text-muted-foreground text-sm">{emptyMessage}</p>
        </div>
      </>
    );
  }

  if (mobileCardView) {
    return (
      <>
        {toolbarContent}
        {/* Mobile: Card view */}
        <div className="block space-y-4 lg:hidden">
          {data.map((item) => {
            const itemKey = String(keyExtractor(item));
            return (
              <Card key={itemKey}>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    {selectable && (
                      <div className="flex items-center gap-2 pb-1">
                        <Checkbox
                          checked={selectedKeys?.has(itemKey) ?? false}
                          onCheckedChange={() => handleSelectRow(itemKey)}
                        />
                        <span className="text-muted-foreground text-xs">
                          Select
                        </span>
                      </div>
                    )}
                    {visibleColumns.map((col) => (
                      <div key={col.key} className="flex justify-between gap-4">
                        <span className="text-muted-foreground text-sm font-medium">
                          {col.label}:
                        </span>
                        <span className="text-right text-sm">
                          {renderCell(item, col.key)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Desktop: Table view */}
        <div className="hidden overflow-x-auto rounded-md border lg:block">
          <Table style={{ minWidth }}>
            <TableHeader>
              <TableRow>
                {selectable && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allSelected}
                      ref={(el) => {
                        if (el)
                          (el as unknown as HTMLInputElement).indeterminate =
                            !!someSelected;
                      }}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                {visibleColumns.map((col) => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => {
                const itemKey = String(keyExtractor(item));
                return (
                  <TableRow
                    key={itemKey}
                    className="hover:bg-muted/50 transition-colors duration-150"
                  >
                    {selectable && (
                      <TableCell>
                        <Checkbox
                          checked={selectedKeys?.has(itemKey) ?? false}
                          onCheckedChange={() => handleSelectRow(itemKey)}
                        />
                      </TableCell>
                    )}
                    {visibleColumns.map((col) => (
                      <TableCell key={col.key}>
                        {renderCell(item, col.key)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </>
    );
  }

  // Scroll-only mode (no card view)
  return (
    <>
      {toolbarContent}
      <div className="w-full overflow-x-auto rounded-md border">
        <Table style={{ minWidth }}>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    ref={(el) => {
                      if (el)
                        (el as unknown as HTMLInputElement).indeterminate =
                          !!someSelected;
                    }}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}
              {visibleColumns.map((col) => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => {
              const itemKey = String(keyExtractor(item));
              return (
                <TableRow key={itemKey}>
                  {selectable && (
                    <TableCell>
                      <Checkbox
                        checked={selectedKeys?.has(itemKey) ?? false}
                        onCheckedChange={() => handleSelectRow(itemKey)}
                      />
                    </TableCell>
                  )}
                  {visibleColumns.map((col) => (
                    <TableCell key={col.key}>
                      {renderCell(item, col.key)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
