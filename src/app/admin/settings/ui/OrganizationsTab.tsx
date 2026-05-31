"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Building2, Settings } from "lucide-react";

interface OrgSettings {
  currency?: string;
  locale?: string;
  timezone?: string;
  defaultRole?: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  settings?: OrgSettings | null;
  _count?: {
    users: number;
  };
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

export default function OrganizationsTab() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
  });

  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsOrgId, setSettingsOrgId] = useState<string | null>(null);
  const [settingsForm, setSettingsForm] = useState<OrgSettings>({
    currency: "USD",
    locale: "en",
    timezone: "UTC",
    defaultRole: "",
  });

  const openSettingsDialog = (org: Organization) => {
    setSettingsOrgId(org.id);
    const s = (org.settings || {}) as OrgSettings;
    setSettingsForm({
      currency: s.currency || "USD",
      locale: s.locale || "en",
      timezone: s.timezone || "UTC",
      defaultRole: s.defaultRole || "",
    });
    setSettingsDialogOpen(true);
  };

  const handleSaveSettings = async () => {
    if (!settingsOrgId) return;
    try {
      const response = await fetch(`/api/organizations/${settingsOrgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: settingsForm }),
      });
      if (response.ok) {
        toast.success("Organization settings saved");
        setSettingsDialogOpen(false);
        fetchOrganizations();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save settings");
      }
    } catch (err) {
      console.error("Failed to save settings", err);
      toast.error("Failed to save settings");
    }
  };

  const fetchOrganizations = async () => {
    try {
      const response = await fetch("/api/organizations");
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data);
      } else {
        toast.error("Failed to load organizations");
      }
    } catch (err) {
      console.error("Failed to load organizations", err);
      toast.error("Failed to load organizations");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const resetForm = () => {
    setFormData({ name: "", slug: "", description: "" });
  };

  const openCreateDialog = () => {
    setEditingId(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (org: Organization) => {
    setEditingId(org.id);
    setFormData({
      name: org.name,
      slug: org.slug,
      description: org.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleNameChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      name: value,
      slug: editingId ? prev.slug : generateSlug(value),
    }));
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error("Organization name is required");
      return;
    }

    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          description: formData.description || undefined,
        }),
      });

      if (response.ok) {
        const newOrg = await response.json();
        setOrganizations([...organizations, newOrg]);
        setIsDialogOpen(false);
        resetForm();
        toast.success("Organization created");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create organization");
      }
    } catch (err) {
      console.error("Failed to create organization", err);
      toast.error("Failed to create organization");
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !formData.name.trim()) return;

    try {
      const response = await fetch(`/api/organizations/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          description: formData.description || undefined,
        }),
      });

      if (response.ok) {
        const updatedOrg = await response.json();
        setOrganizations(
          organizations.map((o) => (o.id === editingId ? updatedOrg : o)),
        );
        setIsDialogOpen(false);
        setEditingId(null);
        resetForm();
        toast.success("Organization updated");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update organization");
      }
    } catch (err) {
      console.error("Failed to update organization", err);
      toast.error("Failed to update organization");
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this organization? This action cannot be undone.",
      )
    )
      return;

    try {
      const response = await fetch(`/api/organizations/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setOrganizations(organizations.filter((o) => o.id !== id));
        toast.success("Organization deleted");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete organization");
      }
    } catch (err) {
      console.error("Failed to delete organization", err);
      toast.error("Failed to delete organization");
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/organizations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      if (response.ok) {
        setOrganizations(
          organizations.map((o) => (o.id === id ? { ...o, isActive } : o)),
        );
        toast.success(`Organization ${isActive ? "activated" : "deactivated"}`);
      } else {
        toast.error("Failed to update organization status");
      }
    } catch (err) {
      console.error("Failed to update organization status", err);
      toast.error("Failed to update organization status");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organizations
            </CardTitle>
            <CardDescription>
              Manage organizations and their settings
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Create Organization
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Loading organizations...
            </p>
          ) : organizations.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No organizations found. Create one to get started.
            </p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {org.slug}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={org.isActive ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() =>
                            handleToggleActive(org.id, !org.isActive)
                          }
                        >
                          {org.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>{org._count?.users ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openSettingsDialog(org)}
                            title="Organization settings"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(org)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(org.id)}
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
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Organization" : "Create Organization"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the organization details below."
                : "Fill in the details to create a new organization."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Acme Corporation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-slug">Slug</Label>
              <Input
                id="org-slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value })
                }
                placeholder="e.g., acme-corporation"
              />
              <p className="text-muted-foreground text-sm">
                Auto-generated from name. Used as a unique identifier.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-description">Description</Label>
              <Input
                id="org-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description"
              />
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

      {/* Org Settings Dialog */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Organization Settings</DialogTitle>
            <DialogDescription>
              Configure defaults for this organization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="settings-currency">Default Currency</Label>
              <Input
                id="settings-currency"
                value={settingsForm.currency || ""}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, currency: e.target.value })
                }
                placeholder="e.g., USD, EUR, GBP"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-locale">Default Locale</Label>
              <Input
                id="settings-locale"
                value={settingsForm.locale || ""}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, locale: e.target.value })
                }
                placeholder="e.g., en, de, fr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-timezone">Default Timezone</Label>
              <Input
                id="settings-timezone"
                value={settingsForm.timezone || ""}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, timezone: e.target.value })
                }
                placeholder="e.g., Europe/Berlin, America/New_York"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-role">Default Role for New Users</Label>
              <Input
                id="settings-role"
                value={settingsForm.defaultRole || ""}
                onChange={(e) =>
                  setSettingsForm({
                    ...settingsForm,
                    defaultRole: e.target.value,
                  })
                }
                placeholder="e.g., Standard User"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSettingsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveSettings}>Save Settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
