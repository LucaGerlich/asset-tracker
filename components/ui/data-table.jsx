"use client";
import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

export function DataTable({ columns, data, searchableColumn, filters = [] }) {
  const [sorting, setSorting] = React.useState([]);
  const [columnFilters, setColumnFilters] = React.useState([]);
  const [search, setSearch] = React.useState("");
  const [columnVisibility, setColumnVisibility] = React.useState({});
  const PAGE_SIZE_OPTIONS = React.useMemo(() => [25, 50, 100], []);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_OPTIONS[0]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row, idx) => row.id || row.userid || row.assetid || row.accessorieid || row.manufacturerid || row.locationid || row.supplierid || row.licenceid || String(idx),
  });

  React.useEffect(() => {
    if (searchableColumn) table.getColumn(searchableColumn)?.setFilterValue(search);
  }, [search, searchableColumn, table]);

  const columnEntries = React.useMemo(
    () => table.getAllLeafColumns().filter((col) => col.getCanHide?.() ?? true),
    [table],
  );

  const showToolbar = searchableColumn || filters.length || columnEntries.length;

  const columnLabelFor = (col) => {
    const header = col.columnDef.header;
    if (typeof header === "string") return header;
    if (typeof col.columnDef.meta?.label === "string") return col.columnDef.meta.label;
    return col.id;
  };

  React.useEffect(() => {
    table.setPageSize(pageSize);
  }, [pageSize, table]);

  return (
    <div className="space-y-3">
      {showToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {searchableColumn ? (
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          ) : <div />}
          <div className="flex items-center gap-2">
            {filters.map((f) => (
              <select
                key={f.columnId}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={table.getColumn(f.columnId)?.getFilterValue() ?? ""}
                onChange={(e) => table.getColumn(f.columnId)?.setFilterValue(e.target.value)}
              >
                <option value="">{f.title}</option>
                {f.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ))}
            {columnEntries.length ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="light" size="sm" className="gap-1">
                    Columns
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {columnEntries.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={col.getIsVisible()}
                      onCheckedChange={(v) => col.toggleVisibility(!!v)}
                      className="capitalize"
                    >
                      {columnLabelFor(col)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id} onClick={header.column.getToggleSortingHandler()} className="cursor-pointer select-none">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: " ▲", desc: " ▼" }[header.column.getIsSorted()]}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Rows per page</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="light" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            Previous
          </Button>
          <Button variant="light" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
