"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Loader2, Zap } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  conditions: string;
  actions: string;
  isActive: boolean;
  lastRunAt: string | null;
  runCount: number;
  createdBy: string;
  creator: {
    userid: string;
    firstname: string;
    lastname: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface ConditionsState {
  daysBeforeExpiry?: number;
  daysBeforeDue?: number;
  fromStatus?: string;
  toStatus?: string;
  threshold?: number;
}

interface ActionConfig {
  type: string;
  recipients?: string;
  messageTemplate?: string;
  webhookUrl?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRIGGER_OPTIONS = [
  { value: "warranty_expiring", label: "Warranty Expiring" },
  { value: "maintenance_due", label: "Maintenance Due" },
  { value: "asset_status_change", label: "Asset Status Change" },
  { value: "license_expiring", label: "License Expiring" },
  { value: "stock_low", label: "Stock Low" },
] as const;

const TRIGGER_BADGE_COLORS: Record<string, string> = {
  warranty_expiring:
    "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
  maintenance_due:
    "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  asset_status_change:
    "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
  license_expiring:
    "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  stock_low:
    "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
};

const ACTION_TYPES = [
  { value: "send_email", label: "Send Email" },
  { value: "send_notification", label: "Send Notification" },
  { value: "create_ticket", label: "Create Ticket" },
  { value: "update_status", label: "Update Status" },
  { value: "webhook", label: "Webhook" },
] as const;

function getTriggerLabel(trigger: string): string {
  return (
    TRIGGER_OPTIONS.find((t) => t.value === trigger)?.label ??
    trigger.replace(/_/g, " ")
  );
}

function parseConditions(raw: string): ConditionsState {
  try {
    return JSON.parse(raw) as ConditionsState;
  } catch {
    return {};
  }
}

function parseActions(raw: string): ActionConfig[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ActionConfig[];
    return [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WorkflowsPageClient() {
  // ---- Data state ----------------------------------------------------------
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ---- Create/Edit dialog state -------------------------------------------
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ---- Form state ----------------------------------------------------------
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTrigger, setFormTrigger] = useState("");
  const [formConditions, setFormConditions] = useState<ConditionsState>({});
  const [formActions, setFormActions] = useState<ActionConfig[]>([]);
  const [formIsActive, setFormIsActive] = useState(true);

  // ---- Delete confirmation -------------------------------------------------
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRule, setDeletingRule] = useState<AutomationRule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ---- Toggling active status inline ---------------------------------------
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ---- Fetch rules ---------------------------------------------------------

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/workflows");
      if (!res.ok) throw new Error("Failed to fetch automation rules");
      const data: AutomationRule[] = await res.json();
      setRules(data);
    } catch {
      toast.error("Failed to load automation rules");
    }
  }, []);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      await fetchRules();
      setIsLoading(false);
    }
    init();
  }, [fetchRules]);

  // ---- Dialog helpers ------------------------------------------------------

  function resetForm() {
    setFormName("");
    setFormDescription("");
    setFormTrigger("");
    setFormConditions({});
    setFormActions([]);
    setFormIsActive(true);
  }

  function openCreateDialog() {
    setEditingRule(null);
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(rule: AutomationRule) {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormDescription(rule.description || "");
    setFormTrigger(rule.trigger);
    setFormConditions(parseConditions(rule.conditions));
    setFormActions(parseActions(rule.actions));
    setFormIsActive(rule.isActive);
    setDialogOpen(true);
  }

  function openDeleteDialog(rule: AutomationRule) {
    setDeletingRule(rule);
    setDeleteDialogOpen(true);
  }

  // ---- Action helpers ------------------------------------------------------

  function isActionSelected(actionType: string): boolean {
    return formActions.some((a) => a.type === actionType);
  }

  function toggleAction(actionType: string) {
    if (isActionSelected(actionType)) {
      setFormActions((prev) => prev.filter((a) => a.type !== actionType));
    } else {
      setFormActions((prev) => [...prev, { type: actionType }]);
    }
  }

  function updateActionConfig(
    actionType: string,
    key: string,
    value: string
  ) {
    setFormActions((prev) =>
      prev.map((a) => (a.type === actionType ? { ...a, [key]: value } : a))
    );
  }

  // ---- Toggle active status inline ----------------------------------------

  async function handleToggleActive(rule: AutomationRule) {
    setTogglingId(rule.id);
    try {
      const res = await fetch(`/api/admin/workflows/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(
          typeof err.error === "string"
            ? err.error
            : "Failed to update rule"
        );
        return;
      }

      toast.success(
        rule.isActive ? "Rule deactivated" : "Rule activated"
      );
      await fetchRules();
    } catch {
      toast.error("Failed to update rule");
    } finally {
      setTogglingId(null);
    }
  }

  // ---- Save (create / update) ---------------------------------------------

  async function handleSave() {
    if (!formName.trim()) {
      toast.error("Rule name is required");
      return;
    }
    if (!formTrigger) {
      toast.error("Trigger is required");
      return;
    }

    setIsSaving(true);
    try {
      const isEditing = !!editingRule;
      const url = isEditing
        ? `/api/admin/workflows/${editingRule.id}`
        : "/api/admin/workflows";
      const method = isEditing ? "PUT" : "POST";

      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        trigger: formTrigger,
        conditions: formConditions,
        actions: formActions,
        ...(isEditing && { isActive: formIsActive }),
        ...(!isEditing && { isActive: formIsActive }),
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(
          typeof err.error === "string"
            ? err.error
            : "Failed to save rule"
        );
        return;
      }

      toast.success(
        isEditing
          ? "Automation rule updated successfully"
          : "Automation rule created successfully"
      );
      setDialogOpen(false);
      await fetchRules();
    } catch {
      toast.error("Failed to save automation rule");
    } finally {
      setIsSaving(false);
    }
  }

  // ---- Delete --------------------------------------------------------------

  async function handleDelete() {
    if (!deletingRule) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/workflows/${deletingRule.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(
          typeof err.error === "string"
            ? err.error
            : "Failed to delete rule"
        );
        return;
      }

      toast.success("Automation rule deleted successfully");
      setDeleteDialogOpen(false);
      setDeletingRule(null);
      await fetchRules();
    } catch {
      toast.error("Failed to delete automation rule");
    } finally {
      setIsDeleting(false);
    }
  }

  // ---- Conditions builder --------------------------------------------------

  function renderConditionsBuilder() {
    switch (formTrigger) {
      case "warranty_expiring":
        return (
          <div className="space-y-2">
            <Label htmlFor="cond-days">Days before expiry</Label>
            <Input
              id="cond-days"
              type="number"
              min={1}
              value={formConditions.daysBeforeExpiry ?? ""}
              onChange={(e) =>
                setFormConditions((prev) => ({
                  ...prev,
                  daysBeforeExpiry: parseInt(e.target.value) || undefined,
                }))
              }
              placeholder="e.g. 30"
            />
          </div>
        );

      case "maintenance_due":
        return (
          <div className="space-y-2">
            <Label htmlFor="cond-days-due">Days before due</Label>
            <Input
              id="cond-days-due"
              type="number"
              min={1}
              value={formConditions.daysBeforeDue ?? ""}
              onChange={(e) =>
                setFormConditions((prev) => ({
                  ...prev,
                  daysBeforeDue: parseInt(e.target.value) || undefined,
                }))
              }
              placeholder="e.g. 7"
            />
          </div>
        );

      case "asset_status_change":
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cond-from">From status</Label>
              <Input
                id="cond-from"
                value={formConditions.fromStatus ?? ""}
                onChange={(e) =>
                  setFormConditions((prev) => ({
                    ...prev,
                    fromStatus: e.target.value,
                  }))
                }
                placeholder="e.g. Active"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cond-to">To status</Label>
              <Input
                id="cond-to"
                value={formConditions.toStatus ?? ""}
                onChange={(e) =>
                  setFormConditions((prev) => ({
                    ...prev,
                    toStatus: e.target.value,
                  }))
                }
                placeholder="e.g. Retired"
              />
            </div>
          </div>
        );

      case "license_expiring":
        return (
          <div className="space-y-2">
            <Label htmlFor="cond-license-days">Days before expiry</Label>
            <Input
              id="cond-license-days"
              type="number"
              min={1}
              value={formConditions.daysBeforeExpiry ?? ""}
              onChange={(e) =>
                setFormConditions((prev) => ({
                  ...prev,
                  daysBeforeExpiry: parseInt(e.target.value) || undefined,
                }))
              }
              placeholder="e.g. 30"
            />
          </div>
        );

      case "stock_low":
        return (
          <div className="space-y-2">
            <Label htmlFor="cond-threshold">Threshold</Label>
            <Input
              id="cond-threshold"
              type="number"
              min={1}
              value={formConditions.threshold ?? ""}
              onChange={(e) =>
                setFormConditions((prev) => ({
                  ...prev,
                  threshold: parseInt(e.target.value) || undefined,
                }))
              }
              placeholder="e.g. 10"
            />
          </div>
        );

      default:
        return (
          <p className="text-sm text-muted-foreground">
            Select a trigger to configure conditions.
          </p>
        );
    }
  }

  // ---- Actions config per type ---------------------------------------------

  function renderActionConfig(actionType: string) {
    const action = formActions.find((a) => a.type === actionType);
    if (!action) return null;

    switch (actionType) {
      case "send_email":
        return (
          <div className="ml-6 mt-2 space-y-2">
            <Label htmlFor={`action-${actionType}-recipients`}>
              Recipients (comma-separated emails)
            </Label>
            <Input
              id={`action-${actionType}-recipients`}
              value={action.recipients ?? ""}
              onChange={(e) =>
                updateActionConfig(actionType, "recipients", e.target.value)
              }
              placeholder="admin@example.com, ops@example.com"
            />
          </div>
        );

      case "send_notification":
        return (
          <div className="ml-6 mt-2 space-y-2">
            <Label htmlFor={`action-${actionType}-message`}>
              Message template
            </Label>
            <Textarea
              id={`action-${actionType}-message`}
              value={action.messageTemplate ?? ""}
              onChange={(e) =>
                updateActionConfig(
                  actionType,
                  "messageTemplate",
                  e.target.value
                )
              }
              placeholder="Asset {{asset_name}} requires attention..."
              rows={3}
            />
          </div>
        );

      case "webhook":
        return (
          <div className="ml-6 mt-2 space-y-2">
            <Label htmlFor={`action-${actionType}-url`}>Webhook URL</Label>
            <Input
              id={`action-${actionType}-url`}
              value={action.webhookUrl ?? ""}
              onChange={(e) =>
                updateActionConfig(actionType, "webhookUrl", e.target.value)
              }
              placeholder="https://example.com/webhook"
            />
          </div>
        );

      default:
        return null;
    }
  }

  // ---- Render --------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading automation rules...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-7 w-7" />
            Automation Rules
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure automated workflows triggered by asset events
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Create Rule
        </Button>
      </div>

      <Separator />

      {/* Rules table */}
      {rules.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No automation rules found. Create your first rule to get started.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left font-medium px-4 py-3">Name</th>
                <th className="text-left font-medium px-4 py-3">Trigger</th>
                <th className="text-center font-medium px-4 py-3">Active</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">
                  Last Run
                </th>
                <th className="text-center font-medium px-4 py-3 hidden sm:table-cell">
                  Run Count
                </th>
                <th className="text-right font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr
                  key={rule.id}
                  className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium">{rule.name}</span>
                      {rule.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {rule.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={
                        TRIGGER_BADGE_COLORS[rule.trigger] ??
                        "bg-gray-100 text-gray-800 border-gray-200"
                      }
                    >
                      {getTriggerLabel(rule.trigger)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={() => handleToggleActive(rule)}
                      disabled={togglingId === rule.id}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {rule.lastRunAt
                      ? new Date(rule.lastRunAt).toLocaleString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums hidden sm:table-cell">
                    {rule.runCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(rule)}
                        title="Edit rule"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(rule)}
                        title="Delete rule"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Edit Automation Rule" : "Create Automation Rule"}
            </DialogTitle>
            <DialogDescription>
              {editingRule
                ? "Update the automation rule configuration."
                : "Configure a new automation rule with trigger, conditions, and actions."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="rule-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="rule-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Warranty Expiry Alert"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="rule-description">Description</Label>
              <Textarea
                id="rule-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe what this rule does..."
                rows={3}
              />
            </div>

            {/* Trigger */}
            <div className="space-y-2">
              <Label htmlFor="rule-trigger">
                Trigger <span className="text-destructive">*</span>
              </Label>
              <Select value={formTrigger} onValueChange={setFormTrigger}>
                <SelectTrigger id="rule-trigger">
                  <SelectValue placeholder="Select a trigger..." />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conditions */}
            {formTrigger && (
              <>
                <Separator />
                <div className="space-y-4">
                  <Label className="text-base">Conditions</Label>
                  {renderConditionsBuilder()}
                </div>
              </>
            )}

            <Separator />

            {/* Actions */}
            <div className="space-y-4">
              <Label className="text-base">Actions</Label>
              <p className="text-xs text-muted-foreground">
                Select one or more actions to execute when this rule triggers.
              </p>

              {ACTION_TYPES.map((actionType) => (
                <div key={actionType.value}>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`action-${actionType.value}`}
                      checked={isActionSelected(actionType.value)}
                      onCheckedChange={() => toggleAction(actionType.value)}
                    />
                    <Label
                      htmlFor={`action-${actionType.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {actionType.label}
                    </Label>
                  </div>
                  {renderActionConfig(actionType.value)}
                </div>
              ))}
            </div>

            <Separator />

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Only active rules will be evaluated and executed
                </p>
              </div>
              <Switch
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
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
              disabled={isSaving || !formName.trim() || !formTrigger}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRule ? "Save Changes" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Automation Rule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the rule{" "}
              <strong>{deletingRule?.name}</strong>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingRule(null);
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
              {isDeleting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
