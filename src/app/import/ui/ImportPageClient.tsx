"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { FileDropZone } from "@/components/FileDropZone";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import HelpTooltip from "@/components/HelpTooltip";

const ENTITY_TYPES = [
  { value: "asset", label: "Assets" },
  { value: "accessory", label: "Accessories" },
  { value: "consumable", label: "Consumables" },
  { value: "licence", label: "Licences" },
  { value: "user", label: "Users" },
  { value: "location", label: "Locations" },
] as const;

const ENTITY_FIELDS: Record<string, string[]> = {
  asset: [
    "assetname",
    "assettag",
    "serialnumber",
    "specs",
    "notes",
    "purchaseprice",
    "purchasedate",
    "mobile",
    "requestable",
  ],
  accessory: [
    "accessoriename",
    "accessorietag",
    "purchaseprice",
    "purchasedate",
    "requestable",
  ],
  consumable: [
    "consumablename",
    "purchaseprice",
    "purchasedate",
    "quantity",
    "minQuantity",
  ],
  licence: [
    "licencekey",
    "licensedtoemail",
    "purchaseprice",
    "purchasedate",
    "expirationdate",
    "notes",
    "requestable",
  ],
  user: ["username", "email", "firstname", "lastname", "isadmin", "canrequest"],
  location: ["locationname", "street", "housenumber", "city", "country"],
};

interface ImportJob {
  id: string;
  entityType: string;
  fileName: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  status: string;
  createdAt: string;
  errors?: { row: number; error: string }[] | null;
}

interface ImportResult {
  successCount: number;
  errorCount: number;
  totalRows: number;
  errors?: { row: number; error: string }[] | null;
}

const historyColumns = [
  { key: "entityType", label: "Type" },
  { key: "fileName", label: "File" },
  { key: "totalRows", label: "Rows" },
  { key: "successCount", label: "Success" },
  { key: "errorCount", label: "Errors" },
  { key: "status", label: "Status" },
  { key: "createdAt", label: "Date" },
];

function formatDate(value: string) {
  const date = new Date(value);
  if (isNaN(date.getTime())) return "-";
  return (
    date.toLocaleDateString() +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          Completed
        </Badge>
      );
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "processing":
      return (
        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
          Processing
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function ImportPageClient() {
  const [entityType, setEntityType] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [history, setHistory] = useState<ImportJob[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/import");
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch {
      // History is optional
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDownloadTemplate = () => {
    if (!entityType) return;
    const fields = ENTITY_FIELDS[entityType];
    if (!fields) return;
    const csv = fields.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${entityType}_template.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!selectedFile || !entityType) return;

    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("entityType", entityType);

      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      setResult({
        successCount: data.successCount,
        errorCount: data.errorCount,
        totalRows: data.totalRows,
        errors: data.errors,
      });

      if (data.errorCount === 0) {
        toast.success(
          `Imported ${data.successCount} ${entityType}(s) successfully`,
        );
      } else {
        toast.warning(`Import completed with ${data.errorCount} error(s)`);
      }

      setSelectedFile(null);
      fetchHistory();
    } catch (err) {
      toast.error("Import failed", { description: (err as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const renderHistoryCell = (item: ImportJob, key: string) => {
    switch (key) {
      case "entityType":
        return <span className="capitalize">{item.entityType}</span>;
      case "fileName":
        return (
          <span className="block max-w-[200px] truncate">{item.fileName}</span>
        );
      case "totalRows":
        return item.totalRows;
      case "successCount":
        return (
          <span className="font-medium text-green-600">
            {item.successCount}
          </span>
        );
      case "errorCount":
        return item.errorCount > 0 ? (
          <span className="font-medium text-red-600">{item.errorCount}</span>
        ) : (
          <span className="text-muted-foreground">0</span>
        );
      case "status":
        return <StatusBadge status={item.status} />;
      case "createdAt":
        return formatDate(item.createdAt);
      default:
        return null;
    }
  };

  return (
    <div className="w-full space-y-6">
      <h1 className="text-2xl font-semibold">Bulk Import</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="max-w-xs flex-1">
              <label className="mb-1.5 flex items-center text-sm font-medium">
                Entity Type
                <HelpTooltip text="Select the type of data you want to import. Each type has specific required columns — download a template to see the expected format." />
              </label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {entityType && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
            )}
          </div>

          {entityType && (
            <FileDropZone
              onFilesSelected={(files) => setSelectedFile(files[0])}
              accept=".csv"
              uploading={uploading}
              label={
                selectedFile
                  ? selectedFile.name
                  : "Drag & drop a CSV file here, or click to browse"
              }
            />
          )}

          {selectedFile && entityType && (
            <div className="flex items-center gap-3">
              <Button onClick={handleImport} disabled={uploading}>
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Importing..." : "Import"}
              </Button>
              {!uploading && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                >
                  Clear
                </Button>
              )}
            </div>
          )}

          {result && (
            <Card className="bg-muted/50">
              <CardContent className="space-y-3 pt-4">
                <div className="flex flex-wrap gap-3">
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                    {result.successCount} succeeded
                  </Badge>
                  {result.errorCount > 0 && (
                    <Badge variant="destructive">
                      {result.errorCount} failed
                    </Badge>
                  )}
                  <Badge variant="secondary">
                    {result.totalRows} total rows
                  </Badge>
                </div>
                {result.errors && result.errors.length > 0 && (
                  <div className="bg-background max-h-48 overflow-y-auto rounded border p-3">
                    <p className="mb-2 text-sm font-medium">Errors:</p>
                    <ul className="space-y-1">
                      {result.errors.map((err, i) => (
                        <li key={i} className="text-destructive text-sm">
                          Row {err.row}: {err.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Import History</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : (
            <ResponsiveTable
              columns={historyColumns}
              data={history}
              renderCell={renderHistoryCell}
              keyExtractor={(item) => item.id}
              emptyMessage="No import history"
              mobileCardView={true}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
