"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, Trash2, GripVertical } from "lucide-react";

interface CustomFieldsTabProps {
  fields: Array<{
    id: string;
    name: string;
    fieldType: string;
    entityType: string;
    isRequired: boolean;
    isActive: boolean;
  }>;
}

const FIELD_TYPES = [
  { id: "text", name: "Text", description: "Single line text input" },
  { id: "textarea", name: "Text Area", description: "Multi-line text input" },
  { id: "number", name: "Number", description: "Numeric input" },
  { id: "date", name: "Date", description: "Date picker" },
  { id: "select", name: "Dropdown", description: "Select from predefined options" },
  { id: "checkbox", name: "Checkbox", description: "Yes/No toggle" },
];

const ENTITY_TYPES = [
  { id: "asset", name: "Assets" },
  { id: "accessory", name: "Accessories" },
  { id: "consumable", name: "Consumables" },
  { id: "license", name: "Licenses" },
];

export default function CustomFieldsTab({ fields: initialFields }: CustomFieldsTabProps) {
  const [fields, setFields] = useState(initialFields);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    fieldType: "text",
    entityType: "asset",
    isRequired: false,
    options: "",
  });

  const handleCreate = async () => {
    try {
      const response = await fetch("/api/admin/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          options: formData.fieldType === "select" ? formData.options.split(",").map((o) => o.trim()) : undefined,
        }),
      });

      if (response.ok) {
        const newField = await response.json();
        setFields([...fields, newField]);
        setIsDialogOpen(false);
        resetForm();
        toast.success("Custom field created");
      } else {
        toast.error("Failed to create custom field");
      }
    } catch (error) {
      toast.error("Failed to create custom field");
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;

    try {
      const response = await fetch(`/api/admin/custom-fields/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          options: formData.fieldType === "select" ? formData.options.split(",").map((o) => o.trim()) : undefined,
        }),
      });

      if (response.ok) {
        const updatedField = await response.json();
        setFields(fields.map((f) => (f.id === editingId ? updatedField : f)));
        setIsDialogOpen(false);
        setEditingId(null);
        resetForm();
        toast.success("Custom field updated");
      } else {
        toast.error("Failed to update custom field");
      }
    } catch (error) {
      toast.error("Failed to update custom field");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this custom field? All data will be lost.")) return;

    try {
      const response = await fetch(`/api/admin/custom-fields/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setFields(fields.filter((f) => f.id !== id));
        toast.success("Custom field deleted");
      } else {
        toast.error("Failed to delete custom field");
      }
    } catch (error) {
      toast.error("Failed to delete custom field");
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/custom-fields/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      if (response.ok) {
        setFields(fields.map((f) => (f.id === id ? { ...f, isActive } : f)));
        toast.success(`Custom field ${isActive ? "enabled" : "disabled"}`);
      } else {
        toast.error("Failed to update custom field");
      }
    } catch (error) {
      toast.error("Failed to update custom field");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      fieldType: "text",
      entityType: "asset",
      isRequired: false,
      options: "",
    });
  };

  const openEditDialog = (field: typeof fields[0]) => {
    setEditingId(field.id);
    setFormData({
      name: field.name,
      fieldType: field.fieldType,
      entityType: field.entityType,
      isRequired: field.isRequired,
      options: "",
    });
    setIsDialogOpen(true);
  };

  const groupedFields = ENTITY_TYPES.map((entity) => ({
    ...entity,
    fields: fields.filter((f) => f.entityType === entity.id),
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Custom Fields</CardTitle>
            <CardDescription>
              Add custom fields to capture additional information for your assets
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingId(null); resetForm(); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Field
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Edit Custom Field" : "Create Custom Field"}
                </DialogTitle>
                <DialogDescription>
                  Define a custom field to capture additional information
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Field Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Serial Port Count"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Entity Type</Label>
                  <Select
                    value={formData.entityType}
                    onValueChange={(value) => setFormData({ ...formData, entityType: value })}
                    disabled={!!editingId}
                  >
                    <SelectTrigger>
                      <SelectValue />
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

                <div className="space-y-2">
                  <Label>Field Type</Label>
                  <Select
                    value={formData.fieldType}
                    onValueChange={(value) => setFormData({ ...formData, fieldType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          <div className="flex flex-col">
                            <span>{type.name}</span>
                            <span className="text-xs text-muted-foreground">{type.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.fieldType === "select" && (
                  <div className="space-y-2">
                    <Label>Options (comma-separated)</Label>
                    <Input
                      value={formData.options}
                      onChange={(e) => setFormData({ ...formData, options: e.target.value })}
                      placeholder="Option 1, Option 2, Option 3"
                    />
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isRequired"
                    checked={formData.isRequired}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isRequired: checked as boolean })
                    }
                  />
                  <label htmlFor="isRequired" className="text-sm">
                    Required field
                  </label>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={editingId ? handleUpdate : handleCreate}>
                  {editingId ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-6">
          {groupedFields.map((group) => (
            <div key={group.id}>
              <h4 className="font-medium mb-3">{group.name}</h4>
              {group.fields.length === 0 ? (
                <p className="text-sm text-muted-foreground mb-4">
                  No custom fields for {group.name.toLowerCase()}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Required</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.fields.map((field) => (
                      <TableRow key={field.id}>
                        <TableCell>
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        </TableCell>
                        <TableCell className="font-medium">{field.name}</TableCell>
                        <TableCell>
                          {FIELD_TYPES.find((t) => t.id === field.fieldType)?.name || field.fieldType}
                        </TableCell>
                        <TableCell>
                          {field.isRequired ? (
                            <Badge variant="secondary">Required</Badge>
                          ) : (
                            <span className="text-muted-foreground">Optional</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={field.isActive ? "default" : "outline"}>
                            {field.isActive ? "Active" : "Disabled"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(field.id, !field.isActive)}
                            >
                              {field.isActive ? "Disable" : "Enable"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(field)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(field.id)}
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
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
