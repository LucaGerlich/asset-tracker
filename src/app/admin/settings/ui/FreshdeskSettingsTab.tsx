"use client";

import React, { useState } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
  Ticket,
} from "lucide-react";

interface FreshdeskSettingsTabProps {
  settings: Array<{
    id: string;
    key: string;
    value: string | null;
    type: string;
    description: string | null;
    isEncrypted: boolean;
  }>;
}

export default function FreshdeskSettingsTab({ settings }: FreshdeskSettingsTabProps) {
  const getSettingValue = (key: string) =>
    settings.find((s) => s.key === key)?.value || "";

  const [domain, setDomain] = useState(getSettingValue("freshdesk_domain") || "");
  const [apiKey, setApiKey] = useState(
    getSettingValue("freshdesk_api_key") ? "********" : ""
  );
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "unknown" | "connected" | "failed"
  >("unknown");

  const handleSave = async () => {
    if (!domain) {
      toast.error("Freshdesk domain is required");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/settings/freshdesk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          apiKey: apiKey !== "********" ? apiKey : undefined,
        }),
      });

      if (response.ok) {
        toast.success("Freshdesk settings saved successfully");
        // Mark API key as saved
        if (apiKey && apiKey !== "********") {
          setApiKey("********");
        }
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save settings");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!domain) {
      toast.error("Please enter your Freshdesk domain first");
      return;
    }

    setIsTesting(true);
    setConnectionStatus("unknown");
    try {
      const response = await fetch("/api/admin/settings/freshdesk/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          apiKey: apiKey !== "********" ? apiKey : "********",
        }),
      });

      const result = await response.json();
      if (result.success) {
        setConnectionStatus("connected");
        toast.success("Successfully connected to Freshdesk!");
      } else {
        setConnectionStatus("failed");
        toast.error(result.error || "Connection test failed");
      }
    } catch {
      setConnectionStatus("failed");
      toast.error("Connection test failed");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Freshdesk Integration
            </span>
            {connectionStatus === "connected" && (
              <Badge
                variant="outline"
                className="bg-green-50 text-green-700 border-green-200"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            )}
            {connectionStatus === "failed" && (
              <Badge
                variant="outline"
                className="bg-red-50 text-red-700 border-red-200"
              >
                <XCircle className="h-3 w-3 mr-1" />
                Connection Failed
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Connect to Freshdesk to view IT support tickets for Hardware Requests
            and Problems
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Freshdesk Domain</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">https://</span>
                <Input
                  id="domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="yourcompany"
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">
                  .freshdesk.com
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Enter your Freshdesk subdomain (e.g., &quot;yourcompany&quot; from
                yourcompany.freshdesk.com)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Freshdesk API key"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Find your API key in Freshdesk under Profile Settings &gt; API Key
              </p>
            </div>
          </div>

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              // Disable if testing, no domain, or no API key (unless it's masked from database)
              disabled={isTesting || !domain || (!apiKey && apiKey !== "********")}
            >
              {isTesting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Test Connection
            </Button>
            <Button
              onClick={handleSave}
              // Disable if saving, no domain, or no API key (unless it's masked from database)
              disabled={isSaving || !domain || (!apiKey && apiKey !== "********")}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ticket Types</CardTitle>
          <CardDescription>
            The following Freshdesk ticket types will be synced and displayed in
            your IT Tickets section
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Hardware Request</Badge>
            <Badge variant="secondary">Problem</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Tickets with these types will appear in the IT Tickets page. Make sure
            these ticket types are configured in your Freshdesk admin settings.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup Guide</CardTitle>
          <CardDescription>How to get your Freshdesk API key</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Log in to your Freshdesk account</li>
            <li>Click on your profile picture in the top right</li>
            <li>Select &quot;Profile Settings&quot;</li>
            <li>Scroll down to find your API Key on the right side</li>
            <li>Copy the API key and paste it above</li>
          </ol>
          <Alert>
            <AlertDescription>
              Your API key is stored securely and encrypted. It will only be used
              to fetch ticket data from Freshdesk.
            </AlertDescription>
          </Alert>
          <Button variant="link" className="p-0" asChild>
            <a
              href="https://support.freshdesk.com/support/solutions/articles/215517-how-to-find-your-api-key"
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn more about Freshdesk API keys
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
