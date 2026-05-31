"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Save,
  Loader2,
  CheckCircle,
  RefreshCw,
  Monitor,
  AlertCircle,
} from "lucide-react";

interface IntuneSetting {
  key: string;
  value: string | null;
  isEncrypted: boolean;
}

interface SyncLog {
  id: string;
  status: string;
  devicesCreated: number;
  devicesUpdated: number;
  devicesSkipped: number;
  errors: Array<{ deviceName: string; error: string }> | null;
  triggeredBy: string | null;
  durationMs: number | null;
  createdAt: string;
}

export default function IntuneSettingsTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Connection
  const [enabled, setEnabled] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  // Sync settings
  const [autoSync, setAutoSync] = useState(false);
  const [autoCreateAssets, setAutoCreateAssets] = useState(true);
  const [autoUpdateAssets, setAutoUpdateAssets] = useState(true);

  // Sync history
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

  // Test result
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    deviceCount?: number;
  } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/settings/intune");
        const data = (await res.json()) as IntuneSetting[];
        const get = (key: string) =>
          data.find((s) => s.key === key)?.value ?? "";

        setEnabled(get("intune.enabled") === "true");
        setTenantId(get("intune.tenantId"));
        setClientId(get("intune.clientId"));
        setClientSecret(get("intune.clientSecret"));
        setAutoSync(get("intune.autoSync") === "true");
        setAutoCreateAssets(get("intune.autoCreateAssets") !== "false");
        setAutoUpdateAssets(get("intune.autoUpdateAssets") !== "false");
      } catch (err) {
        console.error("Failed to load Intune settings", err);
        toast.error("Failed to load Intune settings");
      }

      try {
        const res = await fetch(
          "/api/admin/audit-logs?entity=intune_sync&pageSize=10&sortBy=createdAt&sortOrder=desc",
        );
        if (res.ok) {
          const data = await res.json();
          // Fallback: we'll use the IntuneSyncLog table directly if needed
          if (Array.isArray(data.data)) {
            setSyncLogs(data.data);
          }
        }
      } catch {
        // Sync history is optional, don't block
      }

      setIsLoading(false);
    }
    load();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/settings/intune", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: [
            { key: "intune.enabled", value: String(enabled) },
            { key: "intune.tenantId", value: tenantId },
            { key: "intune.clientId", value: clientId },
            { key: "intune.clientSecret", value: clientSecret },
            { key: "intune.autoSync", value: String(autoSync) },
            {
              key: "intune.autoCreateAssets",
              value: String(autoCreateAssets),
            },
            {
              key: "intune.autoUpdateAssets",
              value: String(autoUpdateAssets),
            },
          ],
        }),
      });

      if (res.ok) {
        toast.success("Intune settings saved");
      } else {
        toast.error("Failed to save settings");
      }
    } catch (err) {
      console.error("Failed to save settings", err);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/settings/intune/test", {
        method: "POST",
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      console.error("Connection test failed", err);
      setTestResult({ success: false, message: "Connection test failed" });
      toast.error("Connection test failed");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/admin/settings/intune/sync", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          `Sync complete: ${data.created} created, ${data.updated} updated, ${data.skipped} skipped`,
        );
      } else {
        toast.error(data.error || "Sync failed");
      }
    } catch (err) {
      console.error("Sync failed", err);
      toast.error("Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            <div>
              <CardTitle className="text-base">
                Microsoft Intune Connection
              </CardTitle>
              <CardDescription>
                Connect to Microsoft Intune to auto-import managed devices.
                Requires an Azure AD app registration with
                DeviceManagementManagedDevices.Read.All permission.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Enable Intune Integration</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="tenantId" className="mb-1 text-xs">
                Tenant ID
              </Label>
              <Input
                id="tenantId"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="clientId" className="mb-1 text-xs">
                Client ID (Application ID)
              </Label>
              <Input
                id="clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="h-8 text-xs"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="clientSecret" className="mb-1 text-xs">
                Client Secret
              </Label>
              <Input
                id="clientSecret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={
                  clientSecret === "********"
                    ? "••••••••"
                    : "Enter client secret"
                }
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleTest}
              disabled={isTesting || !tenantId || !clientId}
            >
              {isTesting ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle className="mr-1 h-3.5 w-3.5" />
              )}
              Test Connection
            </Button>
          </div>

          {testResult && (
            <div
              className={`rounded-md p-3 text-sm ${
                testResult.success
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="mr-1.5 inline h-4 w-4" />
              ) : (
                <AlertCircle className="mr-1.5 inline h-4 w-4" />
              )}
              {testResult.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync Settings</CardTitle>
          <CardDescription>
            Configure how devices are imported from Intune. Categories,
            manufacturers, and models are auto-created based on device data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-Sync (Daily at 8 AM UTC)</Label>
              <p className="text-muted-foreground text-xs">
                Automatically sync devices via cron job
              </p>
            </div>
            <Switch checked={autoSync} onCheckedChange={setAutoSync} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-Create Assets</Label>
              <p className="text-muted-foreground text-xs">
                Create new assets for devices not found in the system
              </p>
            </div>
            <Switch
              checked={autoCreateAssets}
              onCheckedChange={setAutoCreateAssets}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-Update Assets</Label>
              <p className="text-muted-foreground text-xs">
                Update existing assets when device data changes in Intune
              </p>
            </div>
            <Switch
              checked={autoUpdateAssets}
              onCheckedChange={setAutoUpdateAssets}
            />
          </div>

          <div className="border-t pt-4">
            <p className="text-muted-foreground mb-2 text-xs font-medium">
              Auto-Created Categories
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                "iPhone",
                "iPad",
                "Mac",
                "Windows Laptop",
                "Windows Desktop",
                "Android Device",
                "Linux Device",
                "Chromebook",
              ].map((cat) => (
                <span
                  key={cat}
                  className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-[11px]"
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1 h-4 w-4" />
          )}
          Save Settings
        </Button>
        <Button
          variant="outline"
          onClick={handleSync}
          disabled={isSyncing || !enabled}
        >
          {isSyncing ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-4 w-4" />
          )}
          Sync Now
        </Button>
      </div>

      {/* Sync History (if logs available) */}
      {syncLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sync History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Created</th>
                    <th className="pb-2 text-right font-medium">Updated</th>
                    <th className="pb-2 text-right font-medium">Trigger</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="py-1.5">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-1.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            log.status === "success"
                              ? "bg-green-100 text-green-800"
                              : log.status === "partial"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-1.5 text-right">
                        {log.devicesCreated}
                      </td>
                      <td className="py-1.5 text-right">
                        {log.devicesUpdated}
                      </td>
                      <td className="py-1.5 text-right">{log.triggeredBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
