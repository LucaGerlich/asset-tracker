"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
  Edit,
  Trash2,
  Loader2,
  Webhook,
  Eye,
  Copy,
  RefreshCw,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WebhookItem {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  isActive: boolean;
  retryAttempts: number;
  createdAt: string;
  updatedAt: string;
  organizationId: string | null;
  organization: { id: string; name: string } | null;
  _count: { deliveries: number };
}

interface WebhookEvent {
  event: string;
  description: string;
}

interface WebhookDelivery {
  id: string;
  event: string;
  statusCode: number | null;
  response: string | null;
  error: string | null;
  attempt: number;
  success: boolean;
  deliveredAt: string;
}

interface WebhookWithDeliveries extends WebhookItem {
  deliveries: WebhookDelivery[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Event categories for grouping in the form */
const EVENT_CATEGORIES: Record<string, string> = {
  asset: "Asset",
  user: "User",
  license: "License",
  consumable: "Consumable",
  maintenance: "Maintenance",
  import: "Import",
};

function groupEventsByCategory(
  events: WebhookEvent[],
): Record<string, WebhookEvent[]> {
  const groups: Record<string, WebhookEvent[]> = {};

  for (const evt of events) {
    const prefix = evt.event.split(".")[0];
    const label = EVENT_CATEGORIES[prefix] ?? prefix;
    if (!groups[label]) {
      groups[label] = [];
    }
    groups[label].push(evt);
  }

  return groups;
}

/** Truncate a string and append ellipsis */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

/** Generate a random hex secret in the browser */
function generateSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WebhooksTab() {
  // ---- Data state ----------------------------------------------------------
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [availableEvents, setAvailableEvents] = useState<WebhookEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ---- Create/Edit dialog state -------------------------------------------
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookItem | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);

  // ---- Form state ----------------------------------------------------------
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formSecret, setFormSecret] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formRetryAttempts, setFormRetryAttempts] = useState(3);

  // ---- Delete confirmation -------------------------------------------------
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingWebhook, setDeletingWebhook] = useState<WebhookItem | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  // ---- Delivery log dialog -------------------------------------------------
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [deliveryWebhook, setDeliveryWebhook] =
    useState<WebhookWithDeliveries | null>(null);
  const [isLoadingDeliveries, setIsLoadingDeliveries] = useState(false);

  // ---- Toggling active status inline ---------------------------------------
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ---- Fetch webhooks & events --------------------------------------------

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch("/api/webhooks");
      if (!res.ok) throw new Error("Failed to fetch webhooks");
      const data: WebhookItem[] = await res.json();
      setWebhooks(data);
    } catch {
      toast.error("Failed to load webhooks");
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/webhooks", { method: "OPTIONS" });
      if (!res.ok) throw new Error("Failed to fetch events");
      const data = await res.json();
      setAvailableEvents(data.events ?? []);
    } catch {
      toast.error("Failed to load webhook events");
    }
  }, []);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      await Promise.all([fetchWebhooks(), fetchEvents()]);
      setIsLoading(false);
    }
    init();
  }, [fetchWebhooks, fetchEvents]);

  // ---- Dialog helpers ------------------------------------------------------

  function openCreateDialog() {
    setEditingWebhook(null);
    setFormName("");
    setFormUrl("");
    setFormSecret(generateSecret());
    setFormEvents([]);
    setFormIsActive(true);
    setFormRetryAttempts(3);
    setDialogOpen(true);
  }

  function openEditDialog(webhook: WebhookItem) {
    setEditingWebhook(webhook);
    setFormName(webhook.name);
    setFormUrl(webhook.url);
    setFormSecret(webhook.secret ?? "");
    setFormEvents([...webhook.events]);
    setFormIsActive(webhook.isActive);
    setFormRetryAttempts(webhook.retryAttempts);
    setDialogOpen(true);
  }

  function openDeleteDialog(webhook: WebhookItem) {
    setDeletingWebhook(webhook);
    setDeleteDialogOpen(true);
  }

  async function openDeliveryDialog(webhook: WebhookItem) {
    setIsLoadingDeliveries(true);
    setDeliveryDialogOpen(true);
    setDeliveryWebhook(null);

    try {
      const res = await fetch(`/api/webhooks/${webhook.id}`);
      if (!res.ok) throw new Error("Failed to fetch deliveries");
      const data: WebhookWithDeliveries = await res.json();
      setDeliveryWebhook(data);
    } catch {
      toast.error("Failed to load delivery log");
      setDeliveryDialogOpen(false);
    } finally {
      setIsLoadingDeliveries(false);
    }
  }

  function toggleEvent(event: string) {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  function toggleCategoryEvents(categoryEvents: string[]) {
    const allSelected = categoryEvents.every((e) => formEvents.includes(e));
    if (allSelected) {
      setFormEvents((prev) => prev.filter((e) => !categoryEvents.includes(e)));
    } else {
      setFormEvents((prev) => {
        const next = new Set(prev);
        categoryEvents.forEach((e) => next.add(e));
        return Array.from(next);
      });
    }
  }

  function handleRegenerateSecret() {
    setFormSecret(generateSecret());
  }

  function handleCopySecret() {
    navigator.clipboard.writeText(formSecret);
    toast.success("Secret copied to clipboard");
  }

  // ---- Toggle active status inline ----------------------------------------

  async function handleToggleActive(webhook: WebhookItem) {
    setTogglingId(webhook.id);
    try {
      const res = await fetch(`/api/webhooks/${webhook.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !webhook.isActive }),
      });

      if (!res.ok) {
        const err = await res.json();
        const message =
          typeof err.error === "string"
            ? err.error
            : "Failed to update webhook";
        toast.error(message);
        return;
      }

      toast.success(
        webhook.isActive ? "Webhook deactivated" : "Webhook activated",
      );
      await fetchWebhooks();
    } catch {
      toast.error("Failed to update webhook");
    } finally {
      setTogglingId(null);
    }
  }

  // ---- Save (create / update) ---------------------------------------------

  async function handleSave() {
    if (!formName.trim()) {
      toast.error("Webhook name is required");
      return;
    }
    if (!formUrl.trim()) {
      toast.error("Webhook URL is required");
      return;
    }
    if (formEvents.length === 0) {
      toast.error("At least one event must be selected");
      return;
    }

    setIsSaving(true);
    try {
      const isEditing = !!editingWebhook;
      const url = isEditing
        ? `/api/webhooks/${editingWebhook.id}`
        : "/api/webhooks";
      const method = isEditing ? "PUT" : "POST";

      const payload: Record<string, unknown> = {
        name: formName.trim(),
        url: formUrl.trim(),
        events: formEvents,
        isActive: formIsActive,
        retryAttempts: formRetryAttempts,
      };

      // Only send secret when creating or when it has changed
      if (!isEditing || formSecret !== (editingWebhook.secret ?? "")) {
        payload.secret = formSecret || undefined;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        const message =
          typeof err.error === "string" ? err.error : "Failed to save webhook";
        toast.error(message);
        return;
      }

      toast.success(
        isEditing
          ? "Webhook updated successfully"
          : "Webhook created successfully",
      );
      setDialogOpen(false);
      await fetchWebhooks();
    } catch {
      toast.error("Failed to save webhook");
    } finally {
      setIsSaving(false);
    }
  }

  // ---- Delete --------------------------------------------------------------

  async function handleDelete() {
    if (!deletingWebhook) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/webhooks/${deletingWebhook.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        const message =
          typeof err.error === "string"
            ? err.error
            : "Failed to delete webhook";
        toast.error(message);
        return;
      }

      toast.success("Webhook deleted successfully");
      setDeleteDialogOpen(false);
      setDeletingWebhook(null);
      await fetchWebhooks();
    } catch {
      toast.error("Failed to delete webhook");
    } finally {
      setIsDeleting(false);
    }
  }

  // ---- Derived data --------------------------------------------------------

  const eventGroups = groupEventsByCategory(availableEvents);

  // ---- Render --------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        <span className="text-muted-foreground ml-2 text-sm">
          Loading webhooks...
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
            <Webhook className="h-5 w-5" />
            Webhooks
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage outgoing webhooks to notify external services of events
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Create Webhook
        </Button>
      </div>

      <Separator />

      {/* Webhooks table */}
      {webhooks.length === 0 ? (
        <div className="text-muted-foreground py-12 text-center text-sm">
          No webhooks found. Create your first webhook to get started.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="px-4 py-3">Name</TableHead>
                <TableHead className="hidden px-4 py-3 md:table-cell">
                  URL
                </TableHead>
                <TableHead className="px-4 py-3 text-center">Events</TableHead>
                <TableHead className="px-4 py-3 text-center">Active</TableHead>
                <TableHead className="hidden px-4 py-3 text-center sm:table-cell">
                  Deliveries
                </TableHead>
                <TableHead className="px-4 py-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.map((webhook) => (
                <TableRow
                  key={webhook.id}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <TableCell className="px-4 py-3 font-medium">
                    {webhook.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden px-4 py-3 md:table-cell">
                    <span className="font-mono text-xs">
                      {truncate(webhook.url, 40)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-center tabular-nums">
                    <Badge variant="secondary" className="text-xs">
                      {webhook.events.length}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-center">
                    <Switch
                      checked={webhook.isActive}
                      onCheckedChange={() => handleToggleActive(webhook)}
                      disabled={togglingId === webhook.id}
                    />
                  </TableCell>
                  <TableCell className="hidden px-4 py-3 text-center tabular-nums sm:table-cell">
                    {webhook._count.deliveries}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeliveryDialog(webhook)}
                        title="View deliveries"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(webhook)}
                        title="Edit webhook"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(webhook)}
                        title="Delete webhook"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingWebhook ? "Edit Webhook" : "Create Webhook"}
            </DialogTitle>
            <DialogDescription>
              {editingWebhook
                ? "Update the webhook configuration and subscribed events."
                : "Configure a new webhook endpoint and select the events to subscribe to."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="webhook-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="webhook-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Slack Notifications"
              />
            </div>

            {/* URL */}
            <div className="space-y-2">
              <Label htmlFor="webhook-url">
                URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="webhook-url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://example.com/webhook"
              />
              <p className="text-muted-foreground text-xs">
                The endpoint that will receive POST requests for subscribed
                events
              </p>
            </div>

            {/* Secret */}
            <div className="space-y-2">
              <Label htmlFor="webhook-secret">Secret</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="webhook-secret"
                  value={formSecret}
                  onChange={(e) => setFormSecret(e.target.value)}
                  placeholder="Auto-generated if left blank"
                  className="flex-1 font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopySecret}
                  title="Copy secret"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateSecret}
                  title="Regenerate secret"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Used to sign payloads with HMAC-SHA256. Keep this value secure.
              </p>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium">Active</Label>
                <p className="text-muted-foreground text-xs">
                  Only active webhooks will receive event deliveries
                </p>
              </div>
              <Switch
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
            </div>

            {/* Retry Attempts */}
            <div className="space-y-2">
              <Label htmlFor="webhook-retries">Retry Attempts</Label>
              <Input
                id="webhook-retries"
                type="number"
                min={0}
                max={10}
                value={formRetryAttempts}
                onChange={(e) =>
                  setFormRetryAttempts(parseInt(e.target.value) || 0)
                }
                className="w-32"
              />
              <p className="text-muted-foreground text-xs">
                Number of times to retry a failed delivery (0-10)
              </p>
            </div>

            <Separator />

            {/* Events */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base">
                  Events <span className="text-destructive">*</span>
                </Label>
                <span className="text-muted-foreground text-xs">
                  {formEvents.length} of {availableEvents.length} selected
                </span>
              </div>

              {Object.entries(eventGroups).map(([category, events]) => {
                const categoryEventNames = events.map((e) => e.event);
                const allInCategorySelected = categoryEventNames.every((e) =>
                  formEvents.includes(e),
                );
                const someInCategorySelected =
                  !allInCategorySelected &&
                  categoryEventNames.some((e) => formEvents.includes(e));

                return (
                  <div
                    key={category}
                    className="space-y-3 rounded-lg border p-4"
                  >
                    {/* Category header with select-all */}
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`cat-${category}`}
                        checked={
                          allInCategorySelected
                            ? true
                            : someInCategorySelected
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={() =>
                          toggleCategoryEvents(categoryEventNames)
                        }
                      />
                      <Label
                        htmlFor={`cat-${category}`}
                        className="cursor-pointer text-sm font-semibold"
                      >
                        {category}
                      </Label>
                      <span className="text-muted-foreground ml-auto text-xs">
                        {
                          categoryEventNames.filter((e) =>
                            formEvents.includes(e),
                          ).length
                        }
                        /{categoryEventNames.length}
                      </span>
                    </div>

                    {/* Individual events */}
                    <div className="grid grid-cols-1 gap-2 pl-6 sm:grid-cols-2">
                      {events.map((evt) => (
                        <div
                          key={evt.event}
                          className="flex items-center gap-2"
                        >
                          <Checkbox
                            id={`evt-${evt.event}`}
                            checked={formEvents.includes(evt.event)}
                            onCheckedChange={() => toggleEvent(evt.event)}
                          />
                          <Label
                            htmlFor={`evt-${evt.event}`}
                            className="cursor-pointer text-sm font-normal"
                          >
                            {evt.description}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                isSaving ||
                !formName.trim() ||
                !formUrl.trim() ||
                formEvents.length === 0
              }
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingWebhook ? "Save Changes" : "Create Webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Webhook</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the webhook{" "}
              <strong>{deletingWebhook?.name}</strong>? This action cannot be
              undone. All delivery history will also be removed.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingWebhook(null);
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
              Delete Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery Log Dialog */}
      <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Delivery Log
              {deliveryWebhook && (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  &mdash; {deliveryWebhook.name}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Recent webhook delivery attempts (last 20)
            </DialogDescription>
          </DialogHeader>

          {isLoadingDeliveries ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              <span className="text-muted-foreground ml-2 text-sm">
                Loading deliveries...
              </span>
            </div>
          ) : deliveryWebhook?.deliveries.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center text-sm">
              No deliveries recorded for this webhook yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="px-4 py-3">Event</TableHead>
                    <TableHead className="px-4 py-3 text-center">
                      Status
                    </TableHead>
                    <TableHead className="px-4 py-3 text-center">
                      Attempt
                    </TableHead>
                    <TableHead className="hidden px-4 py-3 md:table-cell">
                      Delivered At
                    </TableHead>
                    <TableHead className="hidden px-4 py-3 lg:table-cell">
                      Response
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveryWebhook?.deliveries.map((delivery) => (
                    <TableRow
                      key={delivery.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <TableCell className="px-4 py-3">
                        <span className="font-mono text-xs">
                          {delivery.event}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        {delivery.success ? (
                          <Badge
                            variant="outline"
                            className="border-green-200 bg-green-50 text-xs text-green-700"
                          >
                            {delivery.statusCode ?? "OK"}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-red-200 bg-red-50 text-xs text-red-700"
                          >
                            {delivery.statusCode ?? "Error"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center tabular-nums">
                        {delivery.attempt}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden px-4 py-3 md:table-cell">
                        {new Date(delivery.deliveredAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="hidden px-4 py-3 lg:table-cell">
                        <span className="text-muted-foreground font-mono text-xs">
                          {delivery.error
                            ? truncate(delivery.error, 50)
                            : delivery.response
                              ? truncate(delivery.response, 50)
                              : "--"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
