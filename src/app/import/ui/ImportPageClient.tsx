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
import { ArrowLeft, Download, Upload } from "lucide-react";
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

const REQUIRED_FIELDS: Record<string, string[]> = {
  asset: ["assetname", "assettag", "serialnumber"],
  accessory: ["accessoriename", "accessorietag"],
  consumable: ["consumablename"],
  licence: [],
  user: ["username", "firstname", "lastname"],
  location: ["locationname"],
};

const FIELD_LABELS: Record<string, string> = {
  assetname: "Asset Name",
  assettag: "Asset Tag",
  serialnumber: "Serial Number",
  specs: "Specifications",
  notes: "Notes",
  purchaseprice: "Purchase Price",
  purchasedate: "Purchase Date",
  mobile: "Mobile",
  requestable: "Requestable",
  accessoriename: "Accessory Name",
  accessorietag: "Accessory Tag",
  consumablename: "Consumable Name",
  quantity: "Quantity",
  minQuantity: "Min Quantity",
  licencekey: "Licence Key",
  licensedtoemail: "Licensed To (Email)",
  expirationdate: "Expiration Date",
  username: "Username",
  email: "Email",
  firstname: "First Name",
  lastname: "Last Name",
  isadmin: "Is Admin",
  canrequest: "Can Request",
  locationname: "Location Name",
  street: "Street",
  housenumber: "House Number",
  city: "City",
  country: "Country",
};

// Column mapping type: entity field name → CSV column index (or -1 for skip)
type ColumnMapping = Record<string, number>;

/** Normalize a string for fuzzy matching: lowercase, strip non-alphanumeric */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Fuzzy auto-match CSV headers to entity fields. Returns a mapping of field → column index. */
function autoMatchColumns(
  csvHeaders: string[],
  entityFields: string[],
): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalizedCsv = csvHeaders.map(normalize);

  for (const field of entityFields) {
    const normalizedField = normalize(field);

    // 1. Exact normalized match
    const exactIdx = normalizedCsv.indexOf(normalizedField);
    if (exactIdx !== -1) {
      mapping[field] = exactIdx;
      continue;
    }

    // 2. CSV header contains the field name (e.g., "location_name" contains "locationname")
    const containsIdx = normalizedCsv.findIndex((h) =>
      h.includes(normalizedField),
    );
    if (containsIdx !== -1) {
      mapping[field] = containsIdx;
      continue;
    }

    // 3. Field name contains the CSV header (e.g., "purchaseprice" contains "price")
    const reverseIdx = normalizedCsv.findIndex(
      (h) => h.length >= 3 && normalizedField.includes(h),
    );
    if (reverseIdx !== -1) {
      mapping[field] = reverseIdx;
      continue;
    }

    // No match — skip
    mapping[field] = -1;
  }

  return mapping;
}

/** Parse a single CSV line respecting quoted fields */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

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

  // Column mapping state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [showMapping, setShowMapping] = useState(false);

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

  // Parse CSV on file select to extract headers and preview rows
  const handleFileSelected = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file || !entityType) return;
      setSelectedFile(file);
      setResult(null);

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) return;
        const lines = text.split("\n").filter((l) => l.trim());
        if (lines.length < 1) return;

        const headers = parseCSVLine(lines[0]);
        setCsvHeaders(headers);

        // First 3 data rows as preview
        const preview: string[][] = [];
        for (let i = 1; i < Math.min(lines.length, 4); i++) {
          preview.push(parseCSVLine(lines[i]));
        }
        setCsvPreview(preview);

        // Auto-match columns
        const fields = ENTITY_FIELDS[entityType] || [];
        const mapping = autoMatchColumns(headers, fields);
        setColumnMapping(mapping);
        setShowMapping(true);
      };
      reader.readAsText(file);
    },
    [entityType],
  );

  const handleMappingChange = (field: string, csvIndex: number) => {
    setColumnMapping((prev) => ({ ...prev, [field]: csvIndex }));
  };

  const requiredFields = REQUIRED_FIELDS[entityType] || [];
  const allRequiredMapped = requiredFields.every(
    (f) => columnMapping[f] !== undefined && columnMapping[f] !== -1,
  );

  const handleBackToUpload = () => {
    setShowMapping(false);
    setSelectedFile(null);
    setCsvHeaders([]);
    setCsvPreview([]);
    setColumnMapping({});
  };

  const handleImport = async () => {
    if (!selectedFile || !entityType) return;

    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("entityType", entityType);
      formData.append("columnMapping", JSON.stringify(columnMapping));

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
      setShowMapping(false);
      setCsvHeaders([]);
      setCsvPreview([]);
      setColumnMapping({});
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

          {entityType && !showMapping && (
            <FileDropZone
              onFilesSelected={handleFileSelected}
              accept=".csv"
              uploading={uploading}
              label="Drag & drop a CSV file here, or click to browse"
            />
          )}

          {showMapping && selectedFile && entityType && (
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Map Columns — {selectedFile.name}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBackToUpload}
                  >
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Back
                  </Button>
                </div>
                <p className="text-muted-foreground text-sm">
                  Match your CSV columns to the expected fields. Required fields
                  are marked with *.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2">
                  {(ENTITY_FIELDS[entityType] || []).map((field) => {
                    const isRequired = requiredFields.includes(field);
                    const mappedIdx = columnMapping[field] ?? -1;
                    const previewValue =
                      mappedIdx >= 0 && csvPreview[0]
                        ? csvPreview[0][mappedIdx]
                        : null;

                    return (
                      <div
                        key={field}
                        className="grid grid-cols-[1fr_1fr_1fr] items-center gap-3 sm:grid-cols-[200px_1fr_1fr]"
                      >
                        <span className="text-sm font-medium">
                          {FIELD_LABELS[field] || field}
                          {isRequired && (
                            <span className="ml-0.5 text-red-500">*</span>
                          )}
                        </span>
                        <Select
                          value={String(mappedIdx)}
                          onValueChange={(v) =>
                            handleMappingChange(field, parseInt(v, 10))
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="-1">— Skip —</SelectItem>
                            {csvHeaders.map((header, idx) => (
                              <SelectItem key={idx} value={String(idx)}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-muted-foreground truncate text-xs">
                          {previewValue !== null && previewValue !== undefined
                            ? `e.g. "${previewValue}"`
                            : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {!allRequiredMapped && (
                  <p className="text-sm text-amber-600">
                    All required fields (*) must be mapped before importing.
                  </p>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={handleImport}
                    disabled={uploading || !allRequiredMapped}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? "Importing..." : "Import"}
                  </Button>
                </div>
              </CardContent>
            </Card>
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
