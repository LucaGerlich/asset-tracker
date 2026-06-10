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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";

interface StorageConfig {
  configured: boolean;
  provider?: string;
  endpoint?: string;
  bucket?: string;
  region?: string;
  accessKey?: string;
  secretKey?: string;
  isEnabled?: boolean;
}

export default function StorageSettingsTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(
    null,
  );
  const [testError, setTestError] = useState<string | null>(null);

  const [endpoint, setEndpoint] = useState("");
  const [bucket, setBucket] = useState("");
  const [region, setRegion] = useState("auto");
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [showSecretKey, setShowSecretKey] = useState(false);

  const [credentialsEditing, setCredentialsEditing] = useState(false);
  const [maskedAccessKey, setMaskedAccessKey] = useState<string | null>(null);
  const [maskedSecretKey, setMaskedSecretKey] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/admin/settings/storage");
        if (!res.ok) return;
        const data: StorageConfig = await res.json();
        if (data.configured) {
          setIsConfigured(true);
          setEndpoint(data.endpoint ?? "");
          setBucket(data.bucket ?? "");
          setRegion(data.region ?? "auto");
          setMaskedAccessKey(data.accessKey ?? null);
          setMaskedSecretKey(data.secretKey ?? null);
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleTest = async () => {
    if (!endpoint || !bucket) {
      toast.error("Endpoint and bucket are required to test the connection");
      return;
    }
    const testAccessKey = credentialsEditing ? accessKey : undefined;
    const testSecretKey = credentialsEditing ? secretKey : undefined;
    if (credentialsEditing && (!testAccessKey || !testSecretKey)) {
      toast.error("Access key and secret key are required to test");
      return;
    }
    if (!credentialsEditing && !isConfigured) {
      toast.error("Enter credentials first");
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const body: Record<string, string> = { endpoint, bucket, region };
      if (credentialsEditing) {
        body.accessKey = accessKey;
        body.secretKey = secretKey;
      }
      const res = await fetch("/api/admin/settings/storage/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) {
        setTestResult("success");
        toast.success("Connection successful");
      } else {
        setTestResult("error");
        setTestError(data.error ?? "Connection failed");
        toast.error(data.error ?? "Connection failed");
      }
    } catch {
      setTestResult("error");
      setTestError("Network error");
      toast.error("Network error");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!endpoint || !bucket) {
      toast.error("Endpoint and bucket are required");
      return;
    }
    if (!isConfigured && (!accessKey || !secretKey)) {
      toast.error("Access key and secret key are required");
      return;
    }

    setIsSaving(true);
    try {
      const body: Record<string, string> = { endpoint, bucket, region };
      if (credentialsEditing && accessKey) body.accessKey = accessKey;
      if (credentialsEditing && secretKey) body.secretKey = secretKey;

      const res = await fetch("/api/admin/settings/storage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to save");
      }
      toast.success("Storage configuration saved");
      setIsConfigured(true);
      if (credentialsEditing) {
        setMaskedAccessKey(accessKey.substring(0, 4) + "****");
        setMaskedSecretKey(secretKey.substring(0, 4) + "****");
        setAccessKey("");
        setSecretKey("");
        setCredentialsEditing(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (
      !confirm(
        "Remove storage configuration? Images uploaded to this bucket will no longer be accessible.",
      )
    )
      return;

    setIsRemoving(true);
    try {
      const res = await fetch("/api/admin/settings/storage", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove");
      toast.success("Storage configuration removed");
      setIsConfigured(false);
      setEndpoint("");
      setBucket("");
      setRegion("auto");
      setAccessKey("");
      setSecretKey("");
      setMaskedAccessKey(null);
      setMaskedSecretKey(null);
      setCredentialsEditing(false);
      setTestResult(null);
    } catch {
      toast.error("Failed to remove configuration");
    } finally {
      setIsRemoving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading storage configuration…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Object Storage</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Connect your Hetzner Object Storage bucket (or any S3-compatible
          provider) to enable image uploads for accessories, consumables, and
          components.
        </p>
      </div>

      {/* Status banner */}
      <div
        className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${isConfigured ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30" : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"}`}
      >
        {isConfigured ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        )}
        <div className="flex-1">
          <p
            className={`text-sm font-medium ${isConfigured ? "text-emerald-800 dark:text-emerald-200" : "text-amber-800 dark:text-amber-200"}`}
          >
            {isConfigured ? "Storage configured" : "No storage configured"}
          </p>
          <p
            className={`text-xs ${isConfigured ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}
          >
            {isConfigured
              ? "Image uploads are enabled for your organization."
              : "Image uploads are disabled until a storage bucket is connected."}
          </p>
        </div>
        {isConfigured && (
          <Badge
            variant="outline"
            className="shrink-0 border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
          >
            <HardDrive className="mr-1 h-3 w-3" />
            S3
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bucket Configuration</CardTitle>
          <CardDescription>
            For Hetzner Object Storage: endpoint is{" "}
            <code className="text-xs">
              https://&lt;location&gt;.your-objectstorage.com
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="endpoint">Endpoint URL</Label>
              <Input
                id="endpoint"
                placeholder="https://fsn1.your-objectstorage.com"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bucket">Bucket Name</Label>
              <Input
                id="bucket"
                placeholder="my-asset-tracker-bucket"
                value={bucket}
                onChange={(e) => setBucket(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="region">Region</Label>
              <Input
                id="region"
                placeholder="auto"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Access Credentials</CardTitle>
              <CardDescription>
                Access Key ID and Secret Access Key for your bucket.
              </CardDescription>
            </div>
            {isConfigured && !credentialsEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCredentialsEditing(true);
                  setAccessKey("");
                  setSecretKey("");
                }}
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Change credentials
              </Button>
            )}
            {credentialsEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCredentialsEditing(false);
                  setAccessKey("");
                  setSecretKey("");
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="accessKey">Access Key ID</Label>
            {!credentialsEditing && isConfigured ? (
              <Input
                id="accessKey"
                value={maskedAccessKey ?? ""}
                disabled
                className="font-mono text-sm"
              />
            ) : (
              <Input
                id="accessKey"
                placeholder="XXXXXXXXXXXXXXXXXX"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                autoComplete="off"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="secretKey">Secret Access Key</Label>
            {!credentialsEditing && isConfigured ? (
              <Input
                id="secretKey"
                value={maskedSecretKey ?? ""}
                disabled
                className="font-mono text-sm"
              />
            ) : (
              <div className="relative">
                <Input
                  id="secretKey"
                  type={showSecretKey ? "text" : "password"}
                  placeholder="••••••••••••••••••••••••••••••••••••••••"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  className="pr-10"
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 p-0"
                  onClick={() => setShowSecretKey((v) => !v)}
                >
                  {showSecretKey ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Test result */}
      {testResult && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${testResult === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"}`}
        >
          {testResult === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {testResult === "success"
            ? "Connection test passed — bucket is accessible."
            : (testError ?? "Connection test failed.")}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleTest}
          variant="outline"
          disabled={isTesting || isSaving}
        >
          {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Test Connection
        </Button>
        <Button onClick={handleSave} disabled={isSaving || isTesting}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Configuration
        </Button>
        {isConfigured && (
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive ml-auto"
            onClick={handleRemove}
            disabled={isRemoving}
          >
            {isRemoving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
