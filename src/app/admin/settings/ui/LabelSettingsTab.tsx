"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Tag, Printer, Edit, Trash2, QrCode } from "lucide-react";

interface LabelSettingsTabProps {
  templates: Array<{
    id: string;
    name: string;
    width: unknown;
    height: unknown;
    includeQR: boolean;
    isDefault: boolean;
  }>;
}

const DEFAULT_SIZES = [
  { name: "Small (2\" x 1\")", width: 2, height: 1 },
  { name: "Medium (3\" x 2\")", width: 3, height: 2 },
  { name: "Large (4\" x 2\")", width: 4, height: 2 },
  { name: "Badge (3.5\" x 2\")", width: 3.5, height: 2 },
];

export default function LabelSettingsTab({ templates: initialTemplates }: LabelSettingsTabProps) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    width: 2,
    height: 1,
    includeQR: true,
    includeLogo: false,
    fields: ["assetName", "assetTag", "serialNumber"],
  });

  const availableFields = [
    { id: "assetName", label: "Asset Name" },
    { id: "assetTag", label: "Asset Tag" },
    { id: "serialNumber", label: "Serial Number" },
    { id: "manufacturer", label: "Manufacturer" },
    { id: "model", label: "Model" },
    { id: "location", label: "Location" },
    { id: "category", label: "Category" },
    { id: "purchaseDate", label: "Purchase Date" },
  ];

  const handleCreate = async () => {
    try {
      const response = await fetch("/api/admin/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const newTemplate = await response.json();
        setTemplates([...templates, newTemplate]);
        setIsDialogOpen(false);
        resetForm();
        toast.success("Label template created successfully");
      } else {
        toast.error("Failed to create template");
      }
    } catch (error) {
      toast.error("Failed to create template");
    }
  };

  const handleUpdate = async () => {
    if (!editingTemplate) return;

    try {
      const response = await fetch(`/api/admin/labels/${editingTemplate}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const updatedTemplate = await response.json();
        setTemplates(templates.map((t) => (t.id === editingTemplate ? updatedTemplate : t)));
        setIsDialogOpen(false);
        setEditingTemplate(null);
        resetForm();
        toast.success("Label template updated successfully");
      } else {
        toast.error("Failed to update template");
      }
    } catch (error) {
      toast.error("Failed to update template");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const response = await fetch(`/api/admin/labels/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTemplates(templates.filter((t) => t.id !== id));
        toast.success("Label template deleted successfully");
      } else {
        toast.error("Failed to delete template");
      }
    } catch (error) {
      toast.error("Failed to delete template");
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/labels/${id}/default`, {
        method: "POST",
      });

      if (response.ok) {
        setTemplates(templates.map((t) => ({ ...t, isDefault: t.id === id })));
        toast.success("Default template updated");
      } else {
        toast.error("Failed to update default template");
      }
    } catch (error) {
      toast.error("Failed to update default template");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      width: 2,
      height: 1,
      includeQR: true,
      includeLogo: false,
      fields: ["assetName", "assetTag", "serialNumber"],
    });
  };

  const openEditDialog = (template: typeof templates[0]) => {
    setEditingTemplate(template.id);
    setFormData({
      name: template.name,
      width: Number(template.width),
      height: Number(template.height),
      includeQR: template.includeQR,
      includeLogo: false,
      fields: ["assetName", "assetTag", "serialNumber"],
    });
    setIsDialogOpen(true);
  };

  const toggleField = (fieldId: string) => {
    const currentFields = formData.fields;
    if (currentFields.includes(fieldId)) {
      setFormData({ ...formData, fields: currentFields.filter((f) => f !== fieldId) });
    } else {
      setFormData({ ...formData, fields: [...currentFields, fieldId] });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Label Templates</CardTitle>
            <CardDescription>
              Create and manage label templates for printing asset labels
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingTemplate(null); resetForm(); }}>
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? "Edit Label Template" : "Create Label Template"}
                </DialogTitle>
                <DialogDescription>
                  Configure the label size and what information to include
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Standard Asset Label"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Label Size</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {DEFAULT_SIZES.map((size) => (
                      <Button
                        key={size.name}
                        type="button"
                        variant={
                          formData.width === size.width && formData.height === size.height
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        onClick={() =>
                          setFormData({ ...formData, width: size.width, height: size.height })
                        }
                      >
                        {size.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Width (inches)</Label>
                    <Input
                      type="number"
                      step="0.25"
                      value={formData.width}
                      onChange={(e) =>
                        setFormData({ ...formData, width: parseFloat(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Height (inches)</Label>
                    <Input
                      type="number"
                      step="0.25"
                      value={formData.height}
                      onChange={(e) =>
                        setFormData({ ...formData, height: parseFloat(e.target.value) })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Options</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="includeQR"
                        checked={formData.includeQR}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, includeQR: checked as boolean })
                        }
                      />
                      <label htmlFor="includeQR" className="text-sm">
                        Include QR Code
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="includeLogo"
                        checked={formData.includeLogo}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, includeLogo: checked as boolean })
                        }
                      />
                      <label htmlFor="includeLogo" className="text-sm">
                        Include Logo
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Fields to Include</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableFields.map((field) => (
                      <div key={field.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={field.id}
                          checked={formData.fields.includes(field.id)}
                          onCheckedChange={() => toggleField(field.id)}
                        />
                        <label htmlFor={field.id} className="text-sm">
                          {field.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={editingTemplate ? handleUpdate : handleCreate}>
                  {editingTemplate ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>QR Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>
                    {Number(template.width)}" x {Number(template.height)}"
                  </TableCell>
                  <TableCell>
                    {template.includeQR ? (
                      <QrCode className="h-4 w-4 text-green-600" />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {template.isDefault && (
                      <Badge variant="default">Default</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {!template.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(template.id)}
                        >
                          Set Default
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(template)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {templates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Tag className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No label templates created yet</p>
                    <p className="text-sm text-muted-foreground">
                      Create your first template to start printing asset labels
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Print Labels</CardTitle>
          <CardDescription>
            Print labels for your assets using your configured templates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button variant="outline" asChild>
              <a href="/assets?action=print-labels">
                <Printer className="h-4 w-4 mr-2" />
                Go to Assets to Print Labels
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
