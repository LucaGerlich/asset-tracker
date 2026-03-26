"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Plus, Trash2, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  SEARCHABLE_FIELDS,
  ENTITY_LABELS,
  ENTITY_ID_FIELD,
  ENTITY_NAME_FIELD,
  ENTITY_DETAIL_PATH,
  OPERATOR_LABELS,
  type SearchableEntity,
  type SearchableField,
  type FilterOperator,
  type SearchFilter,
} from "@/lib/search-fields";

interface FilterRow {
  id: string;
  field: string;
  op: FilterOperator;
  value: string;
  isCustom: boolean;
}

interface CustomFieldDef {
  id: string;
  name: string;
  fieldType: string;
}

interface SearchResult {
  data: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/** Map custom field fieldType values to our text/number/date types */
function customFieldTypeToSearchType(
  fieldType: string,
): "text" | "number" | "date" {
  switch (fieldType) {
    case "number":
      return "number";
    case "date":
      return "date";
    default:
      return "text";
  }
}

/** Get the appropriate input type for a given field */
function getInputType(fieldType: "text" | "number" | "date"): string {
  switch (fieldType) {
    case "number":
      return "number";
    case "date":
      return "date";
    default:
      return "text";
  }
}

/** Get available operators based on field type */
function getOperatorsForType(
  fieldType: "text" | "number" | "date",
): FilterOperator[] {
  switch (fieldType) {
    case "number":
      return ["eq", "neq", "gt", "lt", "gte", "lte"];
    case "date":
      return ["eq", "neq", "gt", "lt", "gte", "lte"];
    default:
      return ["eq", "neq", "contains"];
  }
}

/** Friendly operator labels based on field type */
function getOperatorLabel(
  op: FilterOperator,
  fieldType: "text" | "number" | "date",
): string {
  if (fieldType === "date") {
    switch (op) {
      case "eq":
        return "on";
      case "neq":
        return "not on";
      case "gt":
        return "after";
      case "lt":
        return "before";
      case "gte":
        return "on or after";
      case "lte":
        return "on or before";
      default:
        return OPERATOR_LABELS[op];
    }
  }
  return OPERATOR_LABELS[op];
}

export default function AdvancedSearchClient() {
  const [entity, setEntity] = useState<SearchableEntity>("asset");
  const [filters, setFilters] = useState<FilterRow[]>([
    { id: generateId(), field: "", op: "eq", value: "", isCustom: false },
  ]);
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
  const [loadingCustomFields, setLoadingCustomFields] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch custom fields when entity changes
  useEffect(() => {
    let cancelled = false;
    async function fetchCustomFields() {
      setLoadingCustomFields(true);
      try {
        const res = await fetch(
          `/api/custom-fields/values?entityType=${entity}&entityId=_schema_only`,
        );
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data)) {
            setCustomFields(
              data.map(
                (d: { id: string; name: string; fieldType: string }) => ({
                  id: d.id,
                  name: d.name,
                  fieldType: d.fieldType,
                }),
              ),
            );
          }
        } else {
          if (!cancelled) setCustomFields([]);
        }
      } catch {
        if (!cancelled) setCustomFields([]);
      } finally {
        if (!cancelled) setLoadingCustomFields(false);
      }
    }
    fetchCustomFields();
    return () => {
      cancelled = true;
    };
  }, [entity]);

  // Reset filters when entity changes
  const handleEntityChange = useCallback((value: string) => {
    setEntity(value as SearchableEntity);
    setFilters([
      { id: generateId(), field: "", op: "eq", value: "", isCustom: false },
    ]);
    setResults(null);
    setError(null);
    setCurrentPage(1);
  }, []);

  const addFilter = useCallback(() => {
    setFilters((prev) => [
      ...prev,
      { id: generateId(), field: "", op: "eq", value: "", isCustom: false },
    ]);
  }, []);

  const removeFilter = useCallback((id: string) => {
    setFilters((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const updateFilter = useCallback(
    (id: string, updates: Partial<FilterRow>) => {
      setFilters((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...updates } : f)),
      );
    },
    [],
  );

  /** All available fields: standard + custom */
  const allFields: (SearchableField & { isCustom?: boolean })[] = [
    ...SEARCHABLE_FIELDS[entity],
    ...customFields.map((cf) => ({
      key: cf.id,
      label: `${cf.name} (custom)`,
      type: customFieldTypeToSearchType(cf.fieldType),
      isCustom: true,
    })),
  ];

  const getFieldDef = useCallback(
    (fieldKey: string): SearchableField | undefined => {
      return allFields.find((f) => f.key === fieldKey);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entity, customFields],
  );

  const handleSearch = useCallback(
    async (page: number = 1) => {
      // Validate that all filters have required values
      const validFilters = filters.filter((f) => f.field && f.op && f.value);
      if (validFilters.length === 0) {
        setError("Please add at least one complete filter.");
        return;
      }

      setSearching(true);
      setError(null);
      setCurrentPage(page);

      try {
        const searchFilters: SearchFilter[] = validFilters.map((f) => ({
          field: f.field,
          op: f.op,
          value: f.value,
          isCustom: f.isCustom,
        }));

        const params = new URLSearchParams({
          entity,
          filters: JSON.stringify(searchFilters),
          page: String(page),
          pageSize: "25",
        });

        const res = await fetch(`/api/search/advanced?${params.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Search failed (${res.status})`);
        }

        const data: SearchResult = await res.json();
        setResults(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred",
        );
        setResults(null);
      } finally {
        setSearching(false);
      }
    },
    [filters, entity],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSearch(1);
      }
    },
    [handleSearch],
  );

  const idField = ENTITY_ID_FIELD[entity];
  const nameField = ENTITY_NAME_FIELD[entity];
  const detailPath = ENTITY_DETAIL_PATH[entity];

  return (
    <div className="space-y-6">
      {/* Entity selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Search Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Entity Type</Label>
            <Select value={entity} onValueChange={handleEntityChange}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Select entity type" />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(ENTITY_LABELS) as [SearchableEntity, string][]
                ).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter rows */}
          <div className="space-y-3">
            <Label>Filters</Label>
            {filters.map((filter, index) => {
              const fieldDef = filter.field
                ? getFieldDef(filter.field)
                : undefined;
              const fieldType = fieldDef?.type ?? "text";
              const operators = getOperatorsForType(fieldType);

              return (
                <div
                  key={filter.id}
                  className="border-border/60 bg-muted/30 flex flex-wrap items-end gap-2 rounded-lg border p-3"
                >
                  {index > 0 && (
                    <Badge variant="secondary" className="mb-1 self-center">
                      AND
                    </Badge>
                  )}

                  {/* Field selector */}
                  <div className="min-w-[180px] flex-1 space-y-1">
                    <Label className="text-muted-foreground text-xs">
                      Field
                    </Label>
                    <Select
                      value={filter.field}
                      onValueChange={(val) => {
                        const def = allFields.find((f) => f.key === val);
                        updateFilter(filter.id, {
                          field: val,
                          isCustom: def?.isCustom ?? false,
                          op: "eq",
                          value: "",
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {SEARCHABLE_FIELDS[entity].map((f) => (
                          <SelectItem key={f.key} value={f.key}>
                            {f.label}
                          </SelectItem>
                        ))}
                        {customFields.length > 0 && (
                          <>
                            {customFields.map((cf) => (
                              <SelectItem key={cf.id} value={cf.id}>
                                {cf.name} (custom)
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Operator selector */}
                  <div className="min-w-[160px] space-y-1">
                    <Label className="text-muted-foreground text-xs">
                      Operator
                    </Label>
                    <Select
                      value={filter.op}
                      onValueChange={(val) =>
                        updateFilter(filter.id, {
                          op: val as FilterOperator,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {operators.map((op) => (
                          <SelectItem key={op} value={op}>
                            {getOperatorLabel(op, fieldType)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Value input */}
                  <div className="min-w-[180px] flex-1 space-y-1">
                    <Label className="text-muted-foreground text-xs">
                      Value
                    </Label>
                    <Input
                      type={getInputType(fieldType)}
                      step={fieldType === "number" ? "any" : undefined}
                      value={filter.value}
                      onChange={(e) =>
                        updateFilter(filter.id, { value: e.target.value })
                      }
                      onKeyDown={handleKeyDown}
                      placeholder={
                        fieldType === "date"
                          ? "YYYY-MM-DD"
                          : fieldType === "number"
                            ? "0"
                            : "Enter value..."
                      }
                    />
                  </div>

                  {/* Remove button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFilter(filter.id)}
                    disabled={filters.length <= 1}
                    className="shrink-0"
                    aria-label="Remove filter"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={addFilter}>
              <Plus className="mr-1 h-4 w-4" />
              Add Filter
            </Button>
            <Button onClick={() => handleSearch(1)} disabled={searching}>
              {searching ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-1 h-4 w-4" />
              )}
              Search
            </Button>
          </div>

          {loadingCustomFields && (
            <p className="text-muted-foreground text-xs">
              Loading custom fields...
            </p>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Results
                <Badge variant="secondary" className="ml-2">
                  {results.total} {results.total === 1 ? "item" : "items"}
                </Badge>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {results.data.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">
                No results found. Try adjusting your filters.
              </p>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>ID</TableHead>
                        {/* Show columns for each filtered field */}
                        {filters
                          .filter((f) => f.field && !f.isCustom)
                          .filter((f) => f.field !== nameField)
                          .map((f) => {
                            const def = getFieldDef(f.field);
                            return (
                              <TableHead key={f.id}>
                                {def?.label ?? f.field}
                              </TableHead>
                            );
                          })}
                        <TableHead className="w-[80px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.data.map((row) => {
                        const id = String(row[idField] ?? "");
                        const name = String(row[nameField] ?? "---");
                        const href = detailPath.replace("{id}", id);

                        return (
                          <TableRow key={id}>
                            <TableCell className="font-medium">
                              {name}
                            </TableCell>
                            <TableCell className="text-muted-foreground font-mono text-xs">
                              {id.substring(0, 8)}...
                            </TableCell>
                            {filters
                              .filter((f) => f.field && !f.isCustom)
                              .filter((f) => f.field !== nameField)
                              .map((f) => {
                                const val = row[f.field];
                                let display: string;
                                if (val === null || val === undefined) {
                                  display = "---";
                                } else if (
                                  typeof val === "string" &&
                                  /^\d{4}-\d{2}-\d{2}/.test(val)
                                ) {
                                  display = new Date(val).toLocaleDateString();
                                } else if (typeof val === "number") {
                                  display = val.toLocaleString();
                                } else {
                                  display = String(val);
                                }
                                return (
                                  <TableCell key={f.id}>{display}</TableCell>
                                );
                              })}
                            <TableCell>
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={href}>View</Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {results.totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-muted-foreground text-sm">
                      Page {results.page} of {results.totalPages} (
                      {results.total} total)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1 || searching}
                        onClick={() => handleSearch(currentPage - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          currentPage >= results.totalPages || searching
                        }
                        onClick={() => handleSearch(currentPage + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
