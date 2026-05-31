"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Tag, Printer, Edit, Trash2, QrCode } from "lucide-react";
import { renderLabelTemplate, LABEL_PLACEHOLDERS } from "@/lib/label-renderer";

interface LabelSettingsTabProps {
  templates: Array<{
    id: string;
    name: string;
    width: unknown;
    height: unknown;
    layout: string;
    fields: string;
    includeQR: boolean;
    includeLogo: boolean;
    isDefault: boolean;
  }>;
}

const DEFAULT_SIZES = [
  { name: 'Small (2" x 1")', width: 2, height: 1 },
  { name: 'Medium (3" x 2")', width: 3, height: 2 },
  { name: 'Large (4" x 2")', width: 4, height: 2 },
  { name: 'Badge (3.5" x 2")', width: 3.5, height: 2 },
];

const SAMPLE_DATA: Record<string, string> = {
  assetName: 'MacBook Pro 16"',
  assetTag: "AST-001234",
  serialNumber: "C02ZW1XKLVDL",
  manufacturer: "Apple",
  model: "MacBook Pro 16-inch 2023",
  category: "Laptop",
  location: "HQ - Floor 3",
  purchaseDate: "2024-01-15",
  purchasePrice: "$2,499.00",
  status: "Deployed",
  assignedTo: "Jane Smith",
  qrCodeUrl: "https://example.com/assets/abc-123",
};

const DEFAULT_TEMPLATE_LAYOUT = `{{assetName}}
Tag: {{assetTag}}
S/N: {{serialNumber}}
{{#if manufacturer}}Mfg: {{manufacturer}}{{/if}}
{{#if model}}Model: {{model}}{{/if}}
{{#if location}}Location: {{location}}{{/if}}`;

export default function LabelSettingsTab({
  templates: initialTemplates,
}: LabelSettingsTabProps) {
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
    layout: DEFAULT_TEMPLATE_LAYOUT,
    useTemplateMode: true,
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

  const previewHtml = useMemo(() => {
    if (formData.useTemplateMode && formData.layout) {
      return renderLabelTemplate(formData.layout, SAMPLE_DATA);
    }
    return "";
  }, [formData.layout, formData.useTemplateMode]);

  const handleCreate = async () => {
    try {
      const payload = formData.useTemplateMode
        ? {
            name: formData.name,
            width: formData.width,
            height: formData.height,
            includeQR: formData.includeQR,
            includeLogo: formData.includeLogo,
            layout: formData.layout,
            fields: formData.fields,
          }
        : {
            name: formData.name,
            width: formData.width,
            height: formData.height,
            includeQR: formData.includeQR,
            includeLogo: formData.includeLogo,
            fields: formData.fields,
          };

      const response = await fetch("/api/admin/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    } catch (err) {
      console.error("Failed to create template", err);
      toast.error("Failed to create template");
    }
  };

  const handleUpdate = async () => {
    if (!editingTemplate) return;

    try {
      const payload = formData.useTemplateMode
        ? {
            name: formData.name,
            width: formData.width,
            height: formData.height,
            includeQR: formData.includeQR,
            includeLogo: formData.includeLogo,
            layout: formData.layout,
            fields: formData.fields,
          }
        : {
            name: formData.name,
            width: formData.width,
            height: formData.height,
            includeQR: formData.includeQR,
            includeLogo: formData.includeLogo,
            fields: formData.fields,
          };

      const response = await fetch(`/api/admin/labels/${editingTemplate}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const updatedTemplate = await response.json();
        setTemplates(
          templates.map((t) =>
            t.id === editingTemplate ? updatedTemplate : t,
          ),
        );
        setIsDialogOpen(false);
        setEditingTemplate(null);
        resetForm();
        toast.success("Label template updated successfully");
      } else {
        toast.error("Failed to update template");
      }
    } catch (err) {
      console.error("Failed to update template", err);
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
    } catch (err) {
      console.error("Failed to delete template", err);
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
    } catch (err) {
      console.error("Failed to update default template", err);
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
      layout: DEFAULT_TEMPLATE_LAYOUT,
      useTemplateMode: true,
    });
  };

  const openEditDialog = (template: (typeof templates)[0]) => {
    const isTemplate =
      typeof template.layout === "string" && template.layout.includes("{{");
    let fields: string[] = ["assetName", "assetTag", "serialNumber"];
    try {
      const parsed = JSON.parse(template.fields);
      if (Array.isArray(parsed)) fields = parsed;
    } catch {
      // keep default
    }

    setEditingTemplate(template.id);
    setFormData({
      name: template.name,
      width: Number(template.width),
      height: Number(template.height),
      includeQR: template.includeQR,
      includeLogo: template.includeLogo ?? false,
      fields,
      layout: isTemplate ? template.layout : DEFAULT_TEMPLATE_LAYOUT,
      useTemplateMode: isTemplate,
    });
    setIsDialogOpen(true);
  };

  const toggleField = (fieldId: string) => {
    const currentFields = formData.fields;
    if (currentFields.includes(fieldId)) {
      setFormData({
        ...formData,
        fields: currentFields.filter((f) => f !== fieldId),
      });
    } else {
      setFormData({ ...formData, fields: [...currentFields, fieldId] });
    }
  };

  const insertPlaceholder = (key: string) => {
    setFormData((prev) => ({
      ...prev,
      layout: prev.layout + `{{${key}}}`,
    }));
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
              <Button
                onClick={() => {
                  setEditingTemplate(null);
                  resetForm();
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate
                    ? "Edit Label Template"
                    : "Create Label Template"}
                </DialogTitle>
                <DialogDescription>
                  Configure the label size and content layout
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
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
                          formData.width === size.width &&
                          formData.height === size.height
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            width: size.width,
                            height: size.height,
                          })
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
                        setFormData({
                          ...formData,
                          width: parseFloat(e.target.value),
                        })
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
                        setFormData({
                          ...formData,
                          height: parseFloat(e.target.value),
                        })
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
                          setFormData({
                            ...formData,
                            includeQR: checked as boolean,
                          })
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
                          setFormData({
                            ...formData,
                            includeLogo: checked as boolean,
                          })
                        }
                      />
                      <label htmlFor="includeLogo" className="text-sm">
                        Include Logo
                      </label>
                    </div>
                  </div>
                </div>

                {/* Toggle between template mode and legacy fields mode */}
                <div className="space-y-2">
                  <Label>Content Mode</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="useTemplateMode"
                      checked={formData.useTemplateMode}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          useTemplateMode: checked as boolean,
                        })
                      }
                    />
                    <label htmlFor="useTemplateMode" className="text-sm">
                      Use programmable template (with placeholders)
                    </label>
                  </div>
                </div>

                {formData.useTemplateMode ? (
                  <>
                    {/* Template layout editor */}
                    <div className="space-y-2">
                      <Label>Template Layout</Label>
                      <Textarea
                        value={formData.layout}
                        onChange={(e) =>
                          setFormData({ ...formData, layout: e.target.value })
                        }
                        placeholder="Enter template with {{placeholders}}..."
                        rows={8}
                        className="font-mono text-sm"
                      />
                    </div>

                    {/* Placeholder reference */}
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs">
                        Available Placeholders (click to insert)
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {LABEL_PLACEHOLDERS.map((p) => (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => insertPlaceholder(p.key)}
                            className="bg-muted hover:bg-accent hover:text-accent-foreground inline-flex cursor-pointer items-center rounded border px-2 py-0.5 font-mono text-xs transition-colors"
                          >
                            {`{{${p.key}}}`}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => insertPlaceholder("qrCode")}
                          className="bg-muted hover:bg-accent hover:text-accent-foreground inline-flex cursor-pointer items-center rounded border px-2 py-0.5 font-mono text-xs transition-colors"
                        >
                          {`{{qrCode}}`}
                        </button>
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Use{" "}
                        <code className="bg-muted rounded px-1">{`{{#if field}}...{{/if}}`}</code>{" "}
                        to conditionally show content only when a field has a
                        value.
                      </p>
                    </div>

                    {/* Live preview */}
                    <div className="space-y-2">
                      <Label>Live Preview</Label>
                      <div
                        className="min-h-[60px] rounded-md border bg-white p-3 font-mono text-xs break-words whitespace-pre-wrap"
                        style={{ maxWidth: `${formData.width * 96}px` }}
                      >
                        {previewHtml || (
                          <span className="text-muted-foreground italic">
                            Enter a template above to see a preview...
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  /* Legacy fields selection */
                  <div className="space-y-2">
                    <Label>Fields to Include</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {availableFields.map((field) => (
                        <div
                          key={field.id}
                          className="flex items-center space-x-2"
                        >
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
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={editingTemplate ? handleUpdate : handleCreate}
                  disabled={!formData.name.trim()}
                >
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
                <TableHead>Type</TableHead>
                <TableHead>QR Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => {
                const isTemplate =
                  typeof template.layout === "string" &&
                  template.layout.includes("{{");
                return (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">
                      {template.name}
                    </TableCell>
                    <TableCell>
                      {Number(template.width)}&quot; x {Number(template.height)}
                      &quot;
                    </TableCell>
                    <TableCell>
                      <Badge variant={isTemplate ? "default" : "secondary"}>
                        {isTemplate ? "Template" : "Fields"}
                      </Badge>
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
                );
              })}
              {templates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center">
                    <Tag className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
                    <p className="text-muted-foreground">
                      No label templates created yet
                    </p>
                    <p className="text-muted-foreground text-sm">
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
              <Link href="/assets?action=print-labels">
                <Printer className="mr-2 h-4 w-4" />
                Go to Assets to Print Labels
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
