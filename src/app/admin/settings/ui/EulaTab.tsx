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
import { Plus, Edit, Trash2, Loader2, FileText } from "lucide-react";

interface EulaTemplateItem {
  id: string;
  name: string;
  content: string;
  version: number;
  isActive: boolean;
  organizationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function EulaTab() {
  const [templates, setTemplates] = useState<EulaTemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<EulaTemplateItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formVersion, setFormVersion] = useState(1);
  const [formIsActive, setFormIsActive] = useState(true);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] =
    useState<EulaTemplateItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/eula");
      if (!res.ok) throw new Error("Failed to fetch EULA templates");
      const data: EulaTemplateItem[] = await res.json();
      setTemplates(data);
    } catch (err) {
      console.error("Failed to load EULA templates", err);
      toast.error("Failed to load EULA templates");
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

  function openCreateDialog() {
    setEditingTemplate(null);
    setFormName("");
    setFormContent("");
    setFormVersion(1);
    setFormIsActive(true);
    setDialogOpen(true);
  }

  function openEditDialog(template: EulaTemplateItem) {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormContent(template.content);
    setFormVersion(template.version);
    setFormIsActive(template.isActive);
    setDialogOpen(true);
  }

  function openDeleteDialog(template: EulaTemplateItem) {
    setDeletingTemplate(template);
    setDeleteDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (!formContent.trim()) {
      toast.error("Template content is required");
      return;
    }

    setIsSaving(true);
    try {
      const isEditing = !!editingTemplate;

      const payload: Record<string, unknown> = {
        name: formName.trim(),
        content: formContent,
        version: formVersion,
        isActive: formIsActive,
      };

      if (isEditing) {
        payload.id = editingTemplate.id;
      }

      const res = await fetch("/api/eula", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        const message =
          typeof err.error === "string"
            ? err.error
            : "Failed to save EULA template";
        toast.error(message);
        return;
      }

      toast.success(
        isEditing
          ? "EULA template updated successfully"
          : "EULA template created successfully",
      );
      setDialogOpen(false);
      await fetchTemplates();
    } catch (err) {
      console.error("Failed to save EULA template", err);
      toast.error("Failed to save EULA template");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingTemplate) return;

    setIsDeleting(true);
    try {
      const res = await fetch("/api/eula", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deletingTemplate.id }),
      });

      if (!res.ok) {
        const err = await res.json();
        const message =
          typeof err.error === "string"
            ? err.error
            : "Failed to delete EULA template";
        toast.error(message);
        return;
      }

      toast.success("EULA template deleted successfully");
      setDeleteDialogOpen(false);
      setDeletingTemplate(null);
      await fetchTemplates();
    } catch (err) {
      console.error("Failed to delete EULA template", err);
      toast.error("Failed to delete EULA template");
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        <span className="text-muted-foreground ml-2 text-sm">
          Loading EULA templates...
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
            <FileText className="h-5 w-5" />
            EULA Templates
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage end-user license agreements for asset checkouts
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
          No EULA templates found. Create your first template to get started.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="px-4 py-3">Name</TableHead>
                <TableHead className="px-4 py-3 text-center">Version</TableHead>
                <TableHead className="px-4 py-3 text-center">Status</TableHead>
                <TableHead className="hidden px-4 py-3 sm:table-cell">
                  Created
                </TableHead>
                <TableHead className="hidden px-4 py-3 md:table-cell">
                  Updated
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
                  <TableCell className="px-4 py-3 text-center tabular-nums">
                    <Badge variant="secondary" className="text-xs">
                      v{template.version}
                    </Badge>
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
                  <TableCell className="text-muted-foreground hidden px-4 py-3 md:table-cell">
                    {new Date(template.updatedAt).toLocaleDateString()}
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
              {editingTemplate ? "Edit EULA Template" : "Create EULA Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Update the EULA template details and content."
                : "Create a new EULA template for asset checkouts."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="eula-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="eula-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Standard Equipment Agreement"
                maxLength={200}
              />
            </div>

            {/* Version */}
            <div className="space-y-2">
              <Label htmlFor="eula-version">Version</Label>
              <Input
                id="eula-version"
                type="number"
                min={1}
                value={formVersion}
                onChange={(e) => setFormVersion(parseInt(e.target.value) || 1)}
                className="w-32"
              />
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium">Active</Label>
                <p className="text-muted-foreground text-xs">
                  Only active templates can be used for asset checkouts
                </p>
              </div>
              <Switch
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
            </div>

            <Separator />

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="eula-content">
                Content <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="eula-content"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Enter the EULA text (HTML or Markdown supported)..."
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-muted-foreground text-xs">
                The full EULA text that users must accept. Supports HTML and
                Markdown.
              </p>
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
              disabled={isSaving || !formName.trim() || !formContent.trim()}
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
            <DialogTitle>Delete EULA Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the template{" "}
              <strong>{deletingTemplate?.name}</strong>? This action cannot be
              undone. Existing acceptances will be preserved.
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
