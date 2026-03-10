"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Search,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditLogUser {
  userid: string;
  firstname: string;
  lastname: string;
}

interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: AuditLogUser | null;
}

interface PaginatedResponse {
  data: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTION_OPTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "LOGIN_FAILED",
  "PASSWORD_CHANGE",
  "ASSIGN",
  "UNASSIGN",
  "REQUEST",
  "APPROVE",
  "REJECT",
] as const;

const ENTITY_OPTIONS = [
  "user",
  "asset",
  "accessory",
  "license",
  "manufacturer",
  "supplier",
  "location",
  "consumable",
  "asset_category",
  "accessory_category",
  "consumable_category",
  "licence_category",
  "model",
  "status_type",
] as const;

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  UPDATE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  LOGIN:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  LOGOUT: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  LOGIN_FAILED:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  PASSWORD_CHANGE:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  ASSIGN: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  UNASSIGN: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  REQUEST:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  APPROVE:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  REJECT: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function parseDetails(details: string | null): Record<string, unknown> | null {
  if (!details) return null;
  try {
    return JSON.parse(details);
  } catch {
    return null;
  }
}

function formatEntityLabel(entity: string): string {
  return entity
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Detail Row Component
// ---------------------------------------------------------------------------

function DetailPanel({ details }: { details: string | null }) {
  const parsed = parseDetails(details);

  if (!parsed) {
    return (
      <div className="text-muted-foreground px-6 py-4 text-sm">
        No additional details
      </div>
    );
  }

  const changes = parsed.changes as
    | Record<string, { from: unknown; to: unknown }>
    | undefined;
  const otherDetails = { ...parsed };
  delete otherDetails.changes;

  return (
    <div className="space-y-4 px-6 py-4">
      {changes && Object.keys(changes).length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Changes</h4>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Field</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(changes).map(([field, change]) => (
                  <TableRow key={field}>
                    <TableCell className="font-mono text-sm">{field}</TableCell>
                    <TableCell className="text-sm text-red-600 dark:text-red-400">
                      <pre className="break-all whitespace-pre-wrap">
                        {change.from === null
                          ? "null"
                          : typeof change.from === "object"
                            ? JSON.stringify(change.from, null, 2)
                            : String(change.from)}
                      </pre>
                    </TableCell>
                    <TableCell className="text-sm text-green-600 dark:text-green-400">
                      <pre className="break-all whitespace-pre-wrap">
                        {change.to === null
                          ? "null"
                          : typeof change.to === "object"
                            ? JSON.stringify(change.to, null, 2)
                            : String(change.to)}
                      </pre>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {Object.keys(otherDetails).length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Details</h4>
          <pre className="bg-muted overflow-x-auto rounded-md p-3 text-sm break-all whitespace-pre-wrap">
            {JSON.stringify(otherDetails, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

function buildAuditExportRows(logs: AuditLogEntry[]) {
  return {
    headers: [
      "Date",
      "User",
      "Action",
      "Entity",
      "Entity ID",
      "IP Address",
      "User Agent",
      "Details",
    ],
    rows: logs.map((log) => [
      formatDate(log.createdAt),
      log.user ? `${log.user.firstname} ${log.user.lastname}` : "System",
      log.action,
      log.entity,
      log.entityId || "",
      log.ipAddress || "",
      log.userAgent || "",
      log.details || "",
    ]),
  };
}

function exportToCsv(logs: AuditLogEntry[]) {
  const { headers, rows } = buildAuditExportRows(logs);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function exportToExcel(logs: AuditLogEntry[]) {
  const ExcelJS = await import("exceljs");
  const { headers, rows } = buildAuditExportRows(logs);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Audit Logs");

  worksheet.columns = headers.map((h) => ({
    header: h,
    width: Math.max(h.length, 15),
  }));
  for (const row of rows) {
    worksheet.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `audit-logs-${new Date().toISOString().split("T")[0]}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Expandable rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      params.set("sortBy", "createdAt");
      params.set("sortOrder", "desc");

      if (search) params.set("search", search);
      if (actionFilter) params.set("action", actionFilter);
      if (entityFilter) params.set("entity", entityFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch audit logs");
      }

      const data: PaginatedResponse = await res.json();
      setLogs(data.data);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to fetch audit logs",
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, actionFilter, entityFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const clearFilters = () => {
    setSearch("");
    setActionFilter("");
    setEntityFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const hasActiveFilters =
    search || actionFilter || entityFilter || dateFrom || dateTo;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Audit Logs</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCsv(logs)}
              disabled={logs.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToExcel(logs)}
              disabled={logs.length === 0}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* Search */}
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Action filter */}
            <Select
              value={actionFilter}
              onValueChange={(val) => {
                setActionFilter(val === "all" ? "" : val);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {ACTION_OPTIONS.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Entity filter */}
            <Select
              value={entityFilter}
              onValueChange={(val) => {
                setEntityFilter(val === "all" ? "" : val);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Entities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {ENTITY_OPTIONS.map((entity) => (
                  <SelectItem key={entity} value={entity}>
                    {formatEntityLabel(entity)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date From */}
            <Input
              type="date"
              placeholder="From date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />

            {/* Date To */}
            <Input
              type="date"
              placeholder="To date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
              >
                <X className="mr-2 h-4 w-4" />
                Clear Filters
              </Button>
            )}
            <span className="text-muted-foreground ml-auto text-sm">
              {total} {total === 1 ? "result" : "results"}
            </span>
          </div>
        </form>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                <TableHead>Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-muted-foreground py-8 text-center"
                  >
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <TableRow
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleRow(log.id)}
                    >
                      <TableCell>
                        {expandedRows.has(log.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.user
                          ? `${log.user.firstname} ${log.user.lastname}`
                          : "System"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={ACTION_COLORS[log.action] || ""}
                        >
                          {log.action.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatEntityLabel(log.entity)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.entityId
                          ? log.entityId.length > 12
                            ? `${log.entityId.slice(0, 12)}...`
                            : log.entityId
                          : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {log.ipAddress || "-"}
                      </TableCell>
                    </TableRow>

                    {expandedRows.has(log.id) && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 p-0">
                          <DetailPanel details={log.details} />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                Rows per page:
              </span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
