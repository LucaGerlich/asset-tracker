"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface User {
  userid: string;
  username: string | null;
  firstname: string;
  lastname: string;
  email: string | null;
  isadmin: boolean;
}

interface RetentionSettings {
  auditLogRetentionDays: number;
  deletedUserRetentionDays: number;
  exportRetentionDays: number;
  updatedAt: string | null;
}

export default function GDPRDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">GDPR Management</h1>
      <p className="text-muted-foreground mb-6">
        Manage data subject requests, anonymization, and data retention policies.
      </p>

      <Tabs defaultValue="export" className="space-y-6">
        <TabsList>
          <TabsTrigger value="export">Data Export</TabsTrigger>
          <TabsTrigger value="anonymize">Data Anonymization</TabsTrigger>
          <TabsTrigger value="retention">Retention Policy</TabsTrigger>
        </TabsList>

        <TabsContent value="export">
          <DataExportTab />
        </TabsContent>

        <TabsContent value="anonymize">
          <DataAnonymizationTab />
        </TabsContent>

        <TabsContent value="retention">
          <RetentionPolicyTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data Export Tab
// ---------------------------------------------------------------------------

function DataExportTab() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const searchUsers = useCallback(async () => {
    if (!search.trim()) {
      setUsers([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/user?page=1&pageSize=10&search=${encodeURIComponent(search.trim())}`);
      if (!res.ok) throw new Error("Failed to search users");
      const data = await res.json();
      setUsers(data.data || []);
    } catch {
      toast.error("Failed to search users");
      setUsers([]);
    } finally {
      setSearching(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim().length >= 2) {
        searchUsers();
      } else {
        setUsers([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, searchUsers]);

  const handleExport = async (userId: string) => {
    setExporting(userId);
    try {
      const res = await fetch(`/api/admin/gdpr/export/${userId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Export failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gdpr-export-${userId}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast.success("Data export downloaded successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Subject Access Request (DSAR)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Search for a user to export all their associated data as a JSON file.
          This fulfills GDPR Article 15 (Right of Access) requests.
        </p>

        <div className="flex gap-2">
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
          {searching && (
            <span className="text-sm text-muted-foreground self-center">Searching...</span>
          )}
        </div>

        {users.length > 0 && (
          <div className="border rounded-lg divide-y">
            {users.map((user) => (
              <div
                key={user.userid}
                className="flex items-center justify-between p-3"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium">
                      {user.firstname} {user.lastname}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {user.email || "No email"}
                    </p>
                  </div>
                  {user.isadmin && (
                    <Badge variant="secondary">Admin</Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => handleExport(user.userid)}
                  disabled={exporting === user.userid}
                >
                  {exporting === user.userid ? "Exporting..." : "Export Data"}
                </Button>
              </div>
            ))}
          </div>
        )}

        {search.trim().length >= 2 && !searching && users.length === 0 && (
          <p className="text-sm text-muted-foreground">No users found.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Data Anonymization Tab
// ---------------------------------------------------------------------------

function DataAnonymizationTab() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [anonymizing, setAnonymizing] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const searchUsers = useCallback(async () => {
    if (!search.trim()) {
      setUsers([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/user?page=1&pageSize=10&search=${encodeURIComponent(search.trim())}`);
      if (!res.ok) throw new Error("Failed to search users");
      const data = await res.json();
      setUsers(data.data || []);
    } catch {
      toast.error("Failed to search users");
      setUsers([]);
    } finally {
      setSearching(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim().length >= 2) {
        searchUsers();
      } else {
        setUsers([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, searchUsers]);

  const handleAnonymize = async () => {
    if (!selectedUser) return;
    setAnonymizing(true);
    try {
      const res = await fetch(`/api/admin/gdpr/anonymize/${selectedUser.userid}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Anonymization failed");
      }
      toast.success(`User ${selectedUser.firstname} ${selectedUser.lastname} has been anonymized.`);
      setDialogOpen(false);
      setSelectedUser(null);
      setConfirmText("");
      // Re-search to reflect changes
      if (search.trim().length >= 2) {
        searchUsers();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Anonymization failed");
    } finally {
      setAnonymizing(false);
    }
  };

  const openConfirmDialog = (user: User) => {
    setSelectedUser(user);
    setConfirmText("");
    setDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Right to be Forgotten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Search for a user and anonymize their personal data. This fulfills GDPR
            Article 17 (Right to Erasure) requests. This action is irreversible.
          </p>

          <div className="flex gap-2">
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
            {searching && (
              <span className="text-sm text-muted-foreground self-center">Searching...</span>
            )}
          </div>

          {users.length > 0 && (
            <div className="border rounded-lg divide-y">
              {users.map((user) => (
                <div
                  key={user.userid}
                  className="flex items-center justify-between p-3"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">
                        {user.firstname} {user.lastname}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {user.email || "No email"}
                      </p>
                    </div>
                    {user.isadmin && (
                      <Badge variant="secondary">Admin</Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => openConfirmDialog(user)}
                    disabled={user.isadmin}
                    title={user.isadmin ? "Cannot anonymize admin users" : undefined}
                  >
                    Anonymize
                  </Button>
                </div>
              ))}
            </div>
          )}

          {search.trim().length >= 2 && !searching && users.length === 0 && (
            <p className="text-sm text-muted-foreground">No users found.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm User Anonymization</DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="text-sm font-medium text-destructive">
                Warning: This will permanently anonymize all personal data for:
              </p>
              {selectedUser && (
                <p className="mt-2 text-sm">
                  <strong>{selectedUser.firstname} {selectedUser.lastname}</strong>{" "}
                  ({selectedUser.email || "no email"})
                </p>
              )}
              <ul className="mt-3 text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Name will be replaced with &quot;[Deleted] User&quot;</li>
                <li>Email will be replaced with a random anonymized address</li>
                <li>Username will be removed</li>
                <li>User preferences will be deleted</li>
                <li>PII in audit logs will be redacted</li>
              </ul>
            </div>

            <div>
              <Label htmlFor="confirm-anonymize">
                Type <strong>ANONYMIZE</strong> to confirm:
              </Label>
              <Input
                id="confirm-anonymize"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="ANONYMIZE"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setConfirmText("");
              }}
              disabled={anonymizing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleAnonymize}
              disabled={confirmText !== "ANONYMIZE" || anonymizing}
            >
              {anonymizing ? "Anonymizing..." : "Anonymize User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Retention Policy Tab
// ---------------------------------------------------------------------------

function RetentionPolicyTab() {
  const [settings, setSettings] = useState<RetentionSettings>({
    auditLogRetentionDays: 365,
    deletedUserRetentionDays: 90,
    exportRetentionDays: 30,
    updatedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/admin/gdpr/retention");
        if (!res.ok) throw new Error("Failed to fetch settings");
        const data = await res.json();
        setSettings(data);
      } catch {
        toast.error("Failed to load retention settings");
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/gdpr/retention", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditLogRetentionDays: settings.auditLogRetentionDays,
          deletedUserRetentionDays: settings.deletedUserRetentionDays,
          exportRetentionDays: settings.exportRetentionDays,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      const data = await res.json();
      setSettings(data);
      toast.success("Retention settings saved successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Loading retention settings...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Retention Policy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Configure how long different types of data are retained before they become
          eligible for cleanup. These settings help maintain GDPR compliance.
        </p>

        <div className="grid gap-6 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="audit-retention">Audit Log Retention (days)</Label>
            <Input
              id="audit-retention"
              type="number"
              min={1}
              value={settings.auditLogRetentionDays}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  auditLogRetentionDays: parseInt(e.target.value) || 1,
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              How long audit log entries are kept before automatic cleanup.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deleted-user-retention">Deleted User Retention (days)</Label>
            <Input
              id="deleted-user-retention"
              type="number"
              min={1}
              value={settings.deletedUserRetentionDays}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  deletedUserRetentionDays: parseInt(e.target.value) || 1,
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              How long anonymized user records are retained before permanent deletion.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="export-retention">Export Retention (days)</Label>
            <Input
              id="export-retention"
              type="number"
              min={1}
              value={settings.exportRetentionDays}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  exportRetentionDays: parseInt(e.target.value) || 1,
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              How long generated data export files are available for download.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
          {settings.updatedAt && (
            <span className="text-xs text-muted-foreground">
              Last updated: {new Date(settings.updatedAt).toLocaleString()}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
