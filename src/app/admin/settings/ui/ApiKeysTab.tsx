"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Loader2,
  KeyRound,
  Copy,
  AlertTriangle,
} from "lucide-react";

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

interface CreatedKeyResponse {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  createdAt: string;
  key: string;
  message: string;
}

const READ_SCOPES = [
  { value: "asset:view", label: "Assets" },
  { value: "accessory:view", label: "Accessories" },
  { value: "consumable:view", label: "Consumables" },
  { value: "license:view", label: "Licences" },
  { value: "component:view", label: "Components" },
  { value: "user:view", label: "Users" },
  { value: "kit:view", label: "Kits" },
  { value: "report:view", label: "Reports" },
  { value: "report:export", label: "Report Export" },
  { value: "audit:view", label: "Audit Logs" },
  { value: "audit_campaign:view", label: "Audit Campaigns" },
  { value: "reservation:view", label: "Reservations" },
  { value: "org:view", label: "Organizations" },
  { value: "dept:view", label: "Departments" },
  { value: "webhook:view", label: "Webhooks" },
  { value: "eula:view", label: "EULA Templates" },
  { value: "settings:view", label: "Settings" },
];

const WRITE_SCOPES = [
  { value: "asset:create", label: "Assets — Create" },
  { value: "asset:edit", label: "Assets — Edit" },
  { value: "asset:delete", label: "Assets — Delete" },
  { value: "asset:assign", label: "Assets — Assign" },
  { value: "accessory:create", label: "Accessories — Create" },
  { value: "accessory:edit", label: "Accessories — Edit" },
  { value: "accessory:delete", label: "Accessories — Delete" },
  { value: "consumable:create", label: "Consumables — Create" },
  { value: "consumable:edit", label: "Consumables — Edit" },
  { value: "consumable:delete", label: "Consumables — Delete" },
  { value: "license:create", label: "Licences — Create" },
  { value: "license:edit", label: "Licences — Edit" },
  { value: "license:delete", label: "Licences — Delete" },
  { value: "license:assign", label: "Licences — Assign" },
  { value: "component:create", label: "Components — Create" },
  { value: "component:edit", label: "Components — Edit" },
  { value: "component:delete", label: "Components — Delete" },
  { value: "user:create", label: "Users — Create" },
  { value: "user:edit", label: "Users — Edit" },
  { value: "user:delete", label: "Users — Delete" },
  { value: "kit:create", label: "Kits — Create" },
  { value: "kit:edit", label: "Kits — Edit" },
  { value: "kit:delete", label: "Kits — Delete" },
  { value: "kit:checkout", label: "Kits — Checkout" },
  { value: "audit_campaign:create", label: "Audit Campaigns — Create" },
  { value: "audit_campaign:edit", label: "Audit Campaigns — Edit" },
  { value: "audit_campaign:scan", label: "Audit Campaigns — Scan" },
  { value: "reservation:create", label: "Reservations — Create" },
  { value: "reservation:approve", label: "Reservations — Approve" },
  { value: "org:manage", label: "Organizations — Manage" },
  { value: "dept:manage", label: "Departments — Manage" },
  { value: "webhook:manage", label: "Webhooks — Manage" },
  { value: "eula:manage", label: "EULA Templates — Manage" },
  { value: "settings:edit", label: "Settings — Edit" },
  { value: "import:execute", label: "Import — Execute" },
];

const ALL_SCOPES = [...READ_SCOPES, ...WRITE_SCOPES];

// Maps a scope action to a display category
const ACTION_CATEGORIES: Record<string, { label: string; order: number }> = {
  view: { label: "Read", order: 0 },
  create: { label: "Create", order: 1 },
  edit: { label: "Edit", order: 2 },
  delete: { label: "Delete", order: 3 },
  assign: { label: "Assign", order: 4 },
  manage: { label: "Manage", order: 5 },
  approve: { label: "Approve", order: 6 },
  checkout: { label: "Checkout", order: 7 },
  scan: { label: "Scan", order: 8 },
  execute: { label: "Execute", order: 9 },
  export: { label: "Export", order: 10 },
};

/** Extract the resource name from a scope like "asset:view" → "Assets" */
function scopeResourceLabel(scope: string): string {
  const matched = ALL_SCOPES.find((s) => s.value === scope);
  if (matched) {
    // Strip action suffix: "Assets — Create" → "Assets", "Assets" → "Assets"
    return matched.label.split("—")[0].trim();
  }
  return scope.split(":")[0];
}

/** Group scopes by action category for display */
function groupScopesByCategory(
  scopes: string[],
): Array<{ category: string; resources: string[] }> {
  const groups = new Map<string, string[]>();

  for (const scope of scopes) {
    const action = scope.split(":")[1] ?? "other";
    const cat = ACTION_CATEGORIES[action]?.label ?? action;
    const resources = groups.get(cat) ?? [];
    resources.push(scopeResourceLabel(scope));
    groups.set(cat, resources);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      const orderA =
        Object.values(ACTION_CATEGORIES).find((c) => c.label === a)?.order ??
        99;
      const orderB =
        Object.values(ACTION_CATEGORIES).find((c) => c.label === b)?.order ??
        99;
      return orderA - orderB;
    })
    .map(([category, resources]) => ({ category, resources }));
}

/** Compact, grouped scopes display used in popover and reveal dialog */
function ScopesSummary({ scopes }: { scopes: string[] }) {
  const grouped = groupScopesByCategory(scopes);
  return (
    <div className="max-h-64 overflow-y-auto p-3">
      <p className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">
        {scopes.length} scope{scopes.length !== 1 ? "s" : ""} assigned
      </p>
      <div className="space-y-2">
        {grouped.map(({ category, resources }) => (
          <div key={category}>
            <p className="mb-1 text-xs font-semibold">{category}</p>
            <div className="flex flex-wrap gap-1">
              {resources.map((r, i) => (
                <Badge
                  key={`${category}-${r}-${i}`}
                  variant="outline"
                  className="text-[10px] font-normal"
                >
                  {r}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ApiKeysTab() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [formScopes, setFormScopes] = useState<string[]>([]);

  const [revealDialogOpen, setRevealDialogOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedKeyResponse | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingKey, setDeletingKey] = useState<ApiKeyItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/api-keys");
      if (!res.ok) throw new Error("Failed to fetch API keys");
      const data = await res.json();
      setKeys(data.keys ?? []);
    } catch (err) {
      console.error("Failed to load API keys", err);
      toast.error("Failed to load API keys");
    }
  }, []);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      await fetchKeys();
      setIsLoading(false);
    }
    init();
  }, [fetchKeys]);

  function openCreateDialog() {
    setFormName("");
    setFormExpiresAt("");
    setFormScopes([]);
    setCreateDialogOpen(true);
  }

  function openDeleteDialog(key: ApiKeyItem) {
    setDeletingKey(key);
    setDeleteDialogOpen(true);
  }

  function toggleScope(scope: string) {
    setFormScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  function handleCopyKey() {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey.key);
    toast.success("API key copied to clipboard");
  }

  async function handleCreate() {
    if (!formName.trim()) {
      toast.error("API key name is required");
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: formName.trim(),
        scopes: formScopes,
      };

      if (formExpiresAt) {
        payload.expiresAt = formExpiresAt;
      }

      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        const message =
          typeof err.error === "string"
            ? err.error
            : "Failed to create API key";
        toast.error(message);
        return;
      }

      const data: CreatedKeyResponse = await res.json();
      setCreatedKey(data);
      setCreateDialogOpen(false);
      setRevealDialogOpen(true);
      await fetchKeys();
      toast.success("API key created successfully");
    } catch (err) {
      console.error("Failed to create API key", err);
      toast.error("Failed to create API key");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingKey) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/api-keys/${deletingKey.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        const message =
          typeof err.error === "string"
            ? err.error
            : "Failed to revoke API key";
        toast.error(message);
        return;
      }

      toast.success("API key revoked successfully");
      setDeleteDialogOpen(false);
      setDeletingKey(null);
      await fetchKeys();
    } catch (err) {
      console.error("Failed to revoke API key", err);
      toast.error("Failed to revoke API key");
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        <span className="text-muted-foreground ml-2 text-sm">
          Loading API keys...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <KeyRound className="h-5 w-5" />
            API Keys
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Create and manage API keys for programmatic access
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Create API Key
        </Button>
      </div>

      <Separator />

      {/* Keys table */}
      {keys.length === 0 ? (
        <div className="text-muted-foreground py-12 text-center text-sm">
          No API keys found. Create your first API key to get started.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="px-4 py-3">Name</TableHead>
                <TableHead className="px-4 py-3">Key Preview</TableHead>
                <TableHead className="hidden px-4 py-3 text-center md:table-cell">
                  Scopes
                </TableHead>
                <TableHead className="hidden px-4 py-3 sm:table-cell">
                  Created
                </TableHead>
                <TableHead className="hidden px-4 py-3 md:table-cell">
                  Expires
                </TableHead>
                <TableHead className="px-4 py-3 text-center">Status</TableHead>
                <TableHead className="px-4 py-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((apiKey) => {
                const isExpired =
                  apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();
                return (
                  <TableRow
                    key={apiKey.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="px-4 py-3 font-medium">
                      {apiKey.name}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className="font-mono text-xs">
                        {apiKey.keyPrefix}...
                      </span>
                    </TableCell>
                    <TableCell className="hidden px-4 py-3 text-center md:table-cell">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="cursor-pointer">
                            <Badge variant="secondary" className="text-xs">
                              {apiKey.scopes.length} scope
                              {apiKey.scopes.length !== 1 ? "s" : ""}
                            </Badge>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-80 p-0"
                          align="start"
                          side="bottom"
                        >
                          <ScopesSummary scopes={apiKey.scopes} />
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden px-4 py-3 sm:table-cell">
                      {new Date(apiKey.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden px-4 py-3 md:table-cell">
                      {apiKey.expiresAt
                        ? new Date(apiKey.expiresAt).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      {!apiKey.isActive ? (
                        <Badge variant="destructive" className="text-xs">
                          Revoked
                        </Badge>
                      ) : isExpired ? (
                        <Badge variant="secondary" className="text-xs">
                          Expired
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-green-200 bg-green-50 text-xs text-green-700"
                        >
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      {apiKey.isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(apiKey)}
                          title="Revoke API key"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for programmatic access. The full key will
              only be shown once after creation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="apikey-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="apikey-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. CI/CD Pipeline"
                maxLength={100}
              />
            </div>

            {/* Expiration */}
            <div className="space-y-2">
              <Label htmlFor="apikey-expires">Expiration Date</Label>
              <Input
                id="apikey-expires"
                type="date"
                value={formExpiresAt}
                onChange={(e) => setFormExpiresAt(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
              <p className="text-muted-foreground text-xs">
                Leave empty for a key that never expires
              </p>
            </div>

            <Separator />

            {/* Scopes */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base">Scopes</Label>
                <span className="text-muted-foreground text-xs">
                  {formScopes.length} of {ALL_SCOPES.length} selected
                </span>
              </div>

              {/* Read Scopes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Read</Label>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground text-xs underline"
                    onClick={() => {
                      const readValues = READ_SCOPES.map((s) => s.value);
                      const allSelected = readValues.every((v) =>
                        formScopes.includes(v),
                      );
                      if (allSelected) {
                        setFormScopes((prev) =>
                          prev.filter((s) => !readValues.includes(s)),
                        );
                      } else {
                        setFormScopes((prev) => [
                          ...new Set([...prev, ...readValues]),
                        ]);
                      }
                    }}
                  >
                    {READ_SCOPES.every((s) => formScopes.includes(s.value))
                      ? "Deselect all"
                      : "Select all"}
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {READ_SCOPES.map((scope) => (
                    <div key={scope.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`scope-${scope.value}`}
                        checked={formScopes.includes(scope.value)}
                        onCheckedChange={() => toggleScope(scope.value)}
                      />
                      <Label
                        htmlFor={`scope-${scope.value}`}
                        className="cursor-pointer text-sm font-normal"
                      >
                        {scope.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Write Scopes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Write</Label>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground text-xs underline"
                    onClick={() => {
                      const writeValues = WRITE_SCOPES.map((s) => s.value);
                      const allSelected = writeValues.every((v) =>
                        formScopes.includes(v),
                      );
                      if (allSelected) {
                        setFormScopes((prev) =>
                          prev.filter((s) => !writeValues.includes(s)),
                        );
                      } else {
                        setFormScopes((prev) => [
                          ...new Set([...prev, ...writeValues]),
                        ]);
                      }
                    }}
                  >
                    {WRITE_SCOPES.every((s) => formScopes.includes(s.value))
                      ? "Deselect all"
                      : "Select all"}
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {WRITE_SCOPES.map((scope) => (
                    <div key={scope.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`scope-${scope.value}`}
                        checked={formScopes.includes(scope.value)}
                        onCheckedChange={() => toggleScope(scope.value)}
                      />
                      <Label
                        htmlFor={`scope-${scope.value}`}
                        className="cursor-pointer text-sm font-normal"
                      >
                        {scope.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSaving || !formName.trim()}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create API Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal Key Dialog */}
      <Dialog
        open={revealDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreatedKey(null);
          }
          setRevealDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              API Key Created
            </DialogTitle>
            <DialogDescription>
              Copy this key now. It will not be shown again.
            </DialogDescription>
          </DialogHeader>

          {createdKey && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex items-center gap-2">
                  <code className="bg-muted flex-1 rounded-md border px-3 py-2 font-mono text-xs break-all">
                    {createdKey.key}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyKey}
                    title="Copy API key"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Scopes summary */}
              <div className="rounded-md border">
                <ScopesSummary scopes={createdKey.scopes} />
              </div>

              <p className="text-muted-foreground text-xs">
                Store this API key in a secure location. You will not be able to
                retrieve it after closing this dialog.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => {
                setRevealDialogOpen(false);
                setCreatedKey(null);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke the API key{" "}
              <strong>{deletingKey?.name}</strong>? This action cannot be
              undone. Any integrations using this key will stop working.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingKey(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Revoke Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
