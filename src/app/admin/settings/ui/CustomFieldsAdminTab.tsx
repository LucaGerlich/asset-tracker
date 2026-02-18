"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

interface CustomFieldDefinition {
  id: string;
  name: string;
  fieldType: string;
  entityType: string;
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
  options: string[] | null;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  name: string;
  fieldType: string;
  entityType: string;
  options: string;
  isRequired: boolean;
  displayOrder: number;
}

const FIELD_TYPES = [
  { id: "text", name: "Text" },
  { id: "number", name: "Number" },
  { id: "date", name: "Date" },
  { id: "checkbox", name: "Checkbox" },
  { id: "select", name: "Select" },
  { id: "textarea", name: "Textarea" },
];

const ENTITY_TYPES = [
  { id: "asset", name: "Asset" },
  { id: "consumable", name: "Consumable" },
  { id: "licence", name: "Licence" },
  { id: "accessory", name: "Accessory" },
];

const DEFAULT_FORM: FormData = {
  name: "",
  fieldType: "text",
  entityType: "asset",
  options: "",
  isRequired: false,
  displayOrder: 0,
};

export default function CustomFieldsAdminTab() {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingField, setDeletingField] = useState<CustomFieldDefinition | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);

  const fetchFields = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/custom-fields");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setFields(data);
    } catch {
      toast.error("Failed to fetch custom field definitions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  const resetForm = () => {
    setFormData(DEFAULT_FORM);
    setEditingId(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (field: CustomFieldDefinition) => {
    setEditingId(field.id);
    setFormData({
      name: field.name,
      fieldType: field.fieldType,
      entityType: field.entityType,
      options: Array.isArray(field.options) ? field.options.join(", ") : "",
      isRequired: field.isRequired,
      displayOrder: field.displayOrder ?? 0,
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (field: CustomFieldDefinition) => {
    setDeletingField(field);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    setSubmitting(true);

    const payload = {
      name: formData.name.trim(),
      fieldType: formData.fieldType,
      entityType: formData.entityType,
      isRequired: formData.isRequired,
      displayOrder: formData.displayOrder,
      options:
        formData.fieldType === "select"
          ? formData.options
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean)
          : undefined,
    };

    try {
      if (editingId) {
        const response = await fetch(`/api/admin/custom-fields/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to update custom field");
        }

        const updated = await response.json();
        setFields((prev) =>
          prev.map((f) => (f.id === editingId ? updated : f))
        );
        toast.success("Custom field updated successfully");
      } else {
        const response = await fetch("/api/admin/custom-fields", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to create custom field");
        }

        const created = await response.json();
        setFields((prev) => [...prev, created]);
        toast.success("Custom field created successfully");
      }

      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Operation failed"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingField) return;

    try {
      const response = await fetch(
        `/api/admin/custom-fields/${deletingField.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to delete custom field");
      }

      setFields((prev) => prev.filter((f) => f.id !== deletingField.id));
      toast.success("Custom field deleted successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete custom field"
      );
    } finally {
      setDeleteDialogOpen(false);
      setDeletingField(null);
    }
  };

  const fieldTypeLabel = (type: string) =>
    FIELD_TYPES.find((t) => t.id === type)?.name ?? type;

  const entityTypeLabel = (type: string) =>
    ENTITY_TYPES.find((t) => t.id === type)?.name ?? type;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Custom Fields</CardTitle>
            <CardDescription>
              Manage custom field definitions for assets, consumables, licences,
              and accessories
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Create Field
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading custom fields...
              </span>
            </div>
          ) : fields.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">
                No custom fields defined. Create one to get started.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Display Order</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field) => (
                  <TableRow key={field.id}>
                    <TableCell className="font-medium">{field.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {fieldTypeLabel(field.fieldType)}
                      </Badge>
                    </TableCell>
                    <TableCell>{entityTypeLabel(field.entityType)}</TableCell>
                    <TableCell>
                      {field.isRequired ? (
                        <Badge variant="default">Yes</Badge>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell>{field.displayOrder ?? 0}</TableCell>
                    <TableCell>
                      {field.isActive ? (
                        <Badge variant="default">Yes</Badge>
                      ) : (
                        <Badge variant="outline">No</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(field)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(field)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetForm();
          }
          setDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Custom Field" : "Create Custom Field"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cf-name">Name</Label>
              <Input
                id="cf-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Serial Number"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cf-fieldType">Field Type</Label>
              <Select
                value={formData.fieldType}
                onValueChange={(value) =>
                  setFormData({ ...formData, fieldType: value })
                }
              >
                <SelectTrigger id="cf-fieldType">
                  <SelectValue placeholder="Select field type" />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cf-entityType">Entity Type</Label>
              <Select
                value={formData.entityType}
                onValueChange={(value) =>
                  setFormData({ ...formData, entityType: value })
                }
              >
                <SelectTrigger id="cf-entityType">
                  <SelectValue placeholder="Select entity type" />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.fieldType === "select" && (
              <div className="space-y-2">
                <Label htmlFor="cf-options">Options</Label>
                <Textarea
                  id="cf-options"
                  value={formData.options}
                  onChange={(e) =>
                    setFormData({ ...formData, options: e.target.value })
                  }
                  placeholder="Option 1, Option 2, Option 3"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Enter comma-separated values for the dropdown options
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="cf-required">Required</Label>
              <Switch
                id="cf-required"
                checked={formData.isRequired}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isRequired: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cf-displayOrder">Display Order</Label>
              <Input
                id="cf-displayOrder"
                type="number"
                value={formData.displayOrder}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    displayOrder: parseInt(e.target.value, 10) || 0,
                  })
                }
                min={0}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Custom Field</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-4">
            Are you sure you want to delete the custom field{" "}
            <span className="font-semibold text-foreground">
              &quot;{deletingField?.name}&quot;
            </span>
            ? This action cannot be undone and all associated data will be lost.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingField(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
