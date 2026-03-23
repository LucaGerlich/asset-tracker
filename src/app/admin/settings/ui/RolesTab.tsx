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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Shield, Lock, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  organizationId: string | null;
  organization: { id: string; name: string } | null;
  _count: { userRoles: number };
}

interface PermissionGroup {
  label: string;
  permissions: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Group a flat permission list by the entity prefix (asset, user, ...) */
function groupPermissions(allPermissions: string[]): PermissionGroup[] {
  const categoryLabels: Record<string, string> = {
    asset: "Asset",
    user: "User",
    accessory: "Accessory",
    license: "License",
    consumable: "Consumable",
    org: "Organization",
    dept: "Department",
    reservation: "Reservation",
    settings: "Settings",
    report: "Report",
    audit: "Audit",
    webhook: "Webhook",
    import: "Import",
  };

  const grouped: Record<string, string[]> = {};

  for (const perm of allPermissions) {
    const prefix = perm.split(":")[0];
    if (!grouped[prefix]) {
      grouped[prefix] = [];
    }
    grouped[prefix].push(perm);
  }

  return Object.entries(grouped).map(([prefix, perms]) => ({
    label: categoryLabels[prefix] ?? prefix,
    permissions: perms,
  }));
}

/** Pretty-print a permission key (e.g. "asset:create" -> "Create") */
function permissionAction(perm: string): string {
  const action = perm.split(":")[1];
  if (!action) return perm;
  return action.charAt(0).toUpperCase() + action.slice(1);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RolesTab() {
  // ---- Data state ----------------------------------------------------------
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ---- Dialog state --------------------------------------------------------
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ---- Form state ----------------------------------------------------------
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPermissions, setFormPermissions] = useState<string[]>([]);

  // ---- Delete confirmation -------------------------------------------------
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ---- Fetch roles & permissions -------------------------------------------

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/roles");
      if (!res.ok) throw new Error("Failed to fetch roles");
      const data: Role[] = await res.json();
      setRoles(data);
    } catch {
      toast.error("Failed to load roles");
    }
  }, []);

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await fetch("/api/roles", { method: "OPTIONS" });
      if (!res.ok) throw new Error("Failed to fetch permissions");
      const data = await res.json();
      const perms = (data.permissions ?? []).filter(
        (p: unknown): p is string => typeof p === "string",
      );
      setAllPermissions(perms);
    } catch {
      toast.error("Failed to load permissions");
    }
  }, []);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      await Promise.all([fetchRoles(), fetchPermissions()]);
      setIsLoading(false);
    }
    init();
  }, [fetchRoles, fetchPermissions]);

  // ---- Dialog helpers ------------------------------------------------------

  function openCreateDialog() {
    setEditingRole(null);
    setFormName("");
    setFormDescription("");
    setFormPermissions([]);
    setDialogOpen(true);
  }

  function openEditDialog(role: Role) {
    if (role.isSystem) return;
    setEditingRole(role);
    setFormName(role.name);
    setFormDescription(role.description ?? "");
    setFormPermissions([...role.permissions]);
    setDialogOpen(true);
  }

  function openDeleteDialog(role: Role) {
    if (role.isSystem) return;
    setDeletingRole(role);
    setDeleteDialogOpen(true);
  }

  function togglePermission(perm: string) {
    setFormPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  }

  function toggleGroupPermissions(groupPerms: string[]) {
    const allSelected = groupPerms.every((p) => formPermissions.includes(p));
    if (allSelected) {
      setFormPermissions((prev) => prev.filter((p) => !groupPerms.includes(p)));
    } else {
      setFormPermissions((prev) => {
        const next = new Set(prev);
        groupPerms.forEach((p) => next.add(p));
        return Array.from(next);
      });
    }
  }

  // ---- Save (create / update) ---------------------------------------------

  async function handleSave() {
    if (!formName.trim()) {
      toast.error("Role name is required");
      return;
    }

    setIsSaving(true);
    try {
      const isEditing = !!editingRole;
      const url = isEditing ? `/api/roles/${editingRole.id}` : "/api/roles";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          permissions: formPermissions,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        const message =
          typeof err.error === "string" ? err.error : "Failed to save role";
        toast.error(message);
        return;
      }

      toast.success(
        isEditing ? "Role updated successfully" : "Role created successfully",
      );
      setDialogOpen(false);
      await fetchRoles();
    } catch {
      toast.error("Failed to save role");
    } finally {
      setIsSaving(false);
    }
  }

  // ---- Delete --------------------------------------------------------------

  async function handleDelete() {
    if (!deletingRole) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/roles/${deletingRole.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        const message =
          typeof err.error === "string" ? err.error : "Failed to delete role";
        toast.error(message);
        return;
      }

      toast.success("Role deleted successfully");
      setDeleteDialogOpen(false);
      setDeletingRole(null);
      await fetchRoles();
    } catch {
      toast.error("Failed to delete role");
    } finally {
      setIsDeleting(false);
    }
  }

  // ---- Derived data --------------------------------------------------------

  const permissionGroups = groupPermissions(allPermissions);

  // ---- Render --------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        <span className="text-muted-foreground ml-2 text-sm">
          Loading roles...
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
            <Shield className="h-5 w-5" />
            Roles &amp; Permissions
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage roles and their associated permissions
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Create Role
        </Button>
      </div>

      <Separator />

      {/* Roles table */}
      {roles.length === 0 ? (
        <div className="text-muted-foreground py-12 text-center text-sm">
          No roles found. Create your first role to get started.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">
                  Description
                </TableHead>
                <TableHead className="text-center">Type</TableHead>
                <TableHead className="text-center">Permissions</TableHead>
                <TableHead className="text-center">Users</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {role.isSystem && (
                        <Lock className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                      )}
                      {role.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">
                    {role.description || "--"}
                  </TableCell>
                  <TableCell className="text-center">
                    {role.isSystem ? (
                      <Badge variant="secondary" className="text-xs">
                        System
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Custom
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {role.permissions.length}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {role._count.userRoles}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={role.isSystem}
                        onClick={() => openEditDialog(role)}
                        title={
                          role.isSystem
                            ? "System roles cannot be edited"
                            : "Edit role"
                        }
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={role.isSystem}
                        onClick={() => openDeleteDialog(role)}
                        title={
                          role.isSystem
                            ? "System roles cannot be deleted"
                            : "Delete role"
                        }
                        className={
                          role.isSystem
                            ? ""
                            : "text-destructive hover:text-destructive"
                        }
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
              {editingRole ? "Edit Role" : "Create Role"}
            </DialogTitle>
            <DialogDescription>
              {editingRole
                ? "Update the role name, description, and permissions."
                : "Define a new role with a name and set of permissions."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="role-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="role-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. IT Manager"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Input
                id="role-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional description for this role"
              />
            </div>

            <Separator />

            {/* Permissions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base">Permissions</Label>
                <span className="text-muted-foreground text-xs">
                  {formPermissions.length} of {allPermissions.length} selected
                </span>
              </div>

              {permissionGroups.map((group) => {
                const allInGroupSelected = group.permissions.every((p) =>
                  formPermissions.includes(p),
                );
                const someInGroupSelected =
                  !allInGroupSelected &&
                  group.permissions.some((p) => formPermissions.includes(p));

                return (
                  <div
                    key={group.label}
                    className="space-y-3 rounded-lg border p-4"
                  >
                    {/* Group header with select-all */}
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`group-${group.label}`}
                        checked={
                          allInGroupSelected
                            ? true
                            : someInGroupSelected
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={() =>
                          toggleGroupPermissions(group.permissions)
                        }
                      />
                      <Label
                        htmlFor={`group-${group.label}`}
                        className="cursor-pointer text-sm font-semibold"
                      >
                        {group.label}
                      </Label>
                      <span className="text-muted-foreground ml-auto text-xs">
                        {
                          group.permissions.filter((p) =>
                            formPermissions.includes(p),
                          ).length
                        }
                        /{group.permissions.length}
                      </span>
                    </div>

                    {/* Individual permissions */}
                    <div className="grid grid-cols-2 gap-2 pl-6 sm:grid-cols-3">
                      {group.permissions.map((perm) => (
                        <div key={perm} className="flex items-center gap-2">
                          <Checkbox
                            id={`perm-${perm}`}
                            checked={formPermissions.includes(perm)}
                            onCheckedChange={() => togglePermission(perm)}
                          />
                          <Label
                            htmlFor={`perm-${perm}`}
                            className="cursor-pointer text-sm font-normal"
                          >
                            {permissionAction(perm)}
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
              disabled={isSaving || !formName.trim()}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingRole ? "Save Changes" : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the role{" "}
              <strong>{deletingRole?.name}</strong>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          {deletingRole && deletingRole._count.userRoles > 0 && (
            <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
              This role has {deletingRole._count.userRoles} user
              {deletingRole._count.userRoles === 1 ? "" : "s"} assigned. You
              must reassign them before deleting.
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingRole(null);
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
              Delete Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
