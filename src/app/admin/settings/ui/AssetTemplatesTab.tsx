"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Loader2, LayoutTemplate } from "lucide-react";

interface AssetTemplateItem {
  id: string;
  name: string;
  description: string | null;
  assetcategorytypeid: string | null;
  manufacturerid: string | null;
  modelid: string | null;
  statustypeid: string | null;
  locationid: string | null;
  supplierid: string | null;
  defaultSpecs: string | null;
  defaultNotes: string | null;
  isActive: boolean;
  organizationId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AssetTemplatesTab() {
  const [templates, setTemplates] = useState<AssetTemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<AssetTemplateItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formManufacturerId, setFormManufacturerId] = useState("");
  const [formModelId, setFormModelId] = useState("");
  const [formStatusId, setFormStatusId] = useState("");
  const [formLocationId, setFormLocationId] = useState("");
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formDefaultSpecs, setFormDefaultSpecs] = useState("");
  const [formDefaultNotes, setFormDefaultNotes] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] =
    useState<AssetTemplateItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/asset-templates");
      if (!res.ok) throw new Error("Failed to fetch asset templates");
      const data: AssetTemplateItem[] = await res.json();
      setTemplates(data);
    } catch (err) {
      console.error("Failed to load asset templates", err);
      toast.error("Failed to load asset templates");
    }
  }, []);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      await fetchTemplates();
      setIsLoading(false);
    }
    init();
  }, [fetchTemplates]);

  function resetForm() {
    setFormName("");
    setFormDescription("");
    setFormCategoryId("");
    setFormManufacturerId("");
    setFormModelId("");
    setFormStatusId("");
    setFormLocationId("");
    setFormSupplierId("");
    setFormDefaultSpecs("");
    setFormDefaultNotes("");
    setFormIsActive(true);
  }

  function openCreateDialog() {
    setEditingTemplate(null);
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(template: AssetTemplateItem) {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormDescription(template.description ?? "");
    setFormCategoryId(template.assetcategorytypeid ?? "");
    setFormManufacturerId(template.manufacturerid ?? "");
    setFormModelId(template.modelid ?? "");
    setFormStatusId(template.statustypeid ?? "");
    setFormLocationId(template.locationid ?? "");
    setFormSupplierId(template.supplierid ?? "");
    setFormDefaultSpecs(template.defaultSpecs ?? "");
    setFormDefaultNotes(template.defaultNotes ?? "");
    setFormIsActive(template.isActive);
    setDialogOpen(true);
  }

  function openDeleteDialog(template: AssetTemplateItem) {
    setDeletingTemplate(template);
    setDeleteDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim()) {
      toast.error("Template name is required");
      return;
    }

    setIsSaving(true);
    try {
      const isEditing = !!editingTemplate;

      const payload: Record<string, unknown> = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        assetcategorytypeid: formCategoryId || null,
        manufacturerid: formManufacturerId || null,
        modelid: formModelId || null,
        statustypeid: formStatusId || null,
        locationid: formLocationId || null,
        supplierid: formSupplierId || null,
        defaultSpecs: formDefaultSpecs.trim() || null,
        defaultNotes: formDefaultNotes.trim() || null,
        isActive: formIsActive,
      };

      if (isEditing) {
        payload.id = editingTemplate.id;
      }

      const res = await fetch("/api/asset-templates", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        const message =
          typeof err.error === "string"
            ? err.error
            : "Failed to save asset template";
        toast.error(message);
        return;
      }

      toast.success(
        isEditing
          ? "Asset template updated successfully"
          : "Asset template created successfully",
      );
      setDialogOpen(false);
      await fetchTemplates();
    } catch (err) {
      console.error("Failed to save asset template", err);
      toast.error("Failed to save asset template");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingTemplate) return;

    setIsDeleting(true);
    try {
      const res = await fetch("/api/asset-templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deletingTemplate.id }),
      });

      if (!res.ok) {
        const err = await res.json();
        const message =
          typeof err.error === "string"
            ? err.error
            : "Failed to delete asset template";
        toast.error(message);
        return;
      }

      toast.success("Asset template deleted successfully");
      setDeleteDialogOpen(false);
      setDeletingTemplate(null);
      await fetchTemplates();
    } catch (err) {
      console.error("Failed to delete asset template", err);
      toast.error("Failed to delete asset template");
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        <span className="text-muted-foreground ml-2 text-sm">
          Loading asset templates...
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
            <LayoutTemplate className="h-5 w-5" />
            Asset Templates
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Pre-configured templates for quick asset creation
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Create Template
        </Button>
      </div>

      <Separator />

      {/* Templates table */}
      {templates.length === 0 ? (
        <div className="text-muted-foreground py-12 text-center text-sm">
          No asset templates found. Create your first template to get started.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="px-4 py-3">Name</TableHead>
                <TableHead className="hidden px-4 py-3 md:table-cell">
                  Description
                </TableHead>
                <TableHead className="px-4 py-3 text-center">Status</TableHead>
                <TableHead className="hidden px-4 py-3 sm:table-cell">
                  Created
                </TableHead>
                <TableHead className="px-4 py-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow
                  key={template.id}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <TableCell className="px-4 py-3 font-medium">
                    {template.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden max-w-[250px] truncate px-4 py-3 md:table-cell">
                    {template.description || "--"}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-center">
                    {template.isActive ? (
                      <Badge
                        variant="outline"
                        className="border-green-200 bg-green-50 text-xs text-green-700"
                      >
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden px-4 py-3 sm:table-cell">
                    {new Date(template.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(template)}
                        title="Edit template"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(template)}
                        title="Delete template"
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
              {editingTemplate
                ? "Edit Asset Template"
                : "Create Asset Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Update the asset template configuration."
                : "Create a new template to pre-fill asset creation forms."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="template-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="template-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Standard Laptop"
                maxLength={200}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="template-description">Description</Label>
              <Input
                id="template-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of this template"
              />
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium">Active</Label>
                <p className="text-muted-foreground text-xs">
                  Only active templates appear in the asset creation form
                </p>
              </div>
              <Switch
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
            </div>

            <Separator />

            <p className="text-muted-foreground text-sm font-medium">
              Default Values (Optional)
            </p>
            <p className="text-muted-foreground -mt-4 text-xs">
              Enter UUIDs for related entities. These will pre-fill the asset
              creation form.
            </p>

            {/* IDs grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="template-category">Category ID</Label>
                <Input
                  id="template-category"
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  placeholder="UUID"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-manufacturer">Manufacturer ID</Label>
                <Input
                  id="template-manufacturer"
                  value={formManufacturerId}
                  onChange={(e) => setFormManufacturerId(e.target.value)}
                  placeholder="UUID"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-model">Model ID</Label>
                <Input
                  id="template-model"
                  value={formModelId}
                  onChange={(e) => setFormModelId(e.target.value)}
                  placeholder="UUID"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-status">Status ID</Label>
                <Input
                  id="template-status"
                  value={formStatusId}
                  onChange={(e) => setFormStatusId(e.target.value)}
                  placeholder="UUID"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-location">Location ID</Label>
                <Input
                  id="template-location"
                  value={formLocationId}
                  onChange={(e) => setFormLocationId(e.target.value)}
                  placeholder="UUID"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-supplier">Supplier ID</Label>
                <Input
                  id="template-supplier"
                  value={formSupplierId}
                  onChange={(e) => setFormSupplierId(e.target.value)}
                  placeholder="UUID"
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <Separator />

            {/* Default Specs */}
            <div className="space-y-2">
              <Label htmlFor="template-specs">Default Specifications</Label>
              <Textarea
                id="template-specs"
                value={formDefaultSpecs}
                onChange={(e) => setFormDefaultSpecs(e.target.value)}
                placeholder="e.g. 16GB RAM, 512GB SSD, Intel i7"
                rows={3}
              />
            </div>

            {/* Default Notes */}
            <div className="space-y-2">
              <Label htmlFor="template-notes">Default Notes</Label>
              <Textarea
                id="template-notes"
                value={formDefaultNotes}
                onChange={(e) => setFormDefaultNotes(e.target.value)}
                placeholder="Any default notes for assets created from this template"
                rows={3}
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
              disabled={isSaving || !formName.trim()}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Asset Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the template{" "}
              <strong>{deletingTemplate?.name}</strong>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingTemplate(null);
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
              Delete Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
