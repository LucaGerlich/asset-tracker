"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Send,
  Eye,
  EyeOff,
} from "lucide-react";
import { EMAIL_PROVIDERS } from "@/lib/email/types";

interface EmailSettingsTabProps {
  settings: Array<{
    id: string;
    key: string;
    value: string | null;
    type: string;
    description: string | null;
    isEncrypted: boolean;
  }>;
}

export default function EmailSettingsTab({ settings }: EmailSettingsTabProps) {
  const getSettingValue = (key: string) =>
    settings.find((s) => s.key === key)?.value || "";

  const [provider, setProvider] = useState(getSettingValue("email_provider") || "");
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState(getSettingValue("email_from") || "");
  const [fromName, setFromName] = useState(getSettingValue("email_from_name") || "Asset Tracker");
  const [domain, setDomain] = useState(getSettingValue("email_domain") || "");
  const [region, setRegion] = useState(getSettingValue("email_region") || "us-east-1");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "connected" | "failed">("unknown");

  const selectedProvider = EMAIL_PROVIDERS.find((p) => p.id === provider);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/settings/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: apiKey || undefined,
          fromEmail,
          fromName,
          domain: provider === "mailgun" ? domain : undefined,
          region: provider === "ses" ? region : undefined,
          accessKeyId: provider === "ses" ? accessKeyId : undefined,
          secretAccessKey: provider === "ses" ? secretAccessKey : undefined,
        }),
      });

      if (response.ok) {
        toast.success("Email settings saved successfully");
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to save settings");
      }
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionStatus("unknown");
    try {
      const response = await fetch("/api/admin/settings/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail }),
      });

      const result = await response.json();
      if (result.success) {
        setConnectionStatus("connected");
        toast.success("Test email sent successfully!");
      } else {
        setConnectionStatus("failed");
        toast.error(result.error || "Connection test failed");
      }
    } catch (error) {
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
            Email Provider Configuration
            {connectionStatus === "connected" && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            )}
            {connectionStatus === "failed" && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                <XCircle className="h-3 w-3 mr-1" />
                Connection Failed
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Choose your preferred email provider for sending transactional emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="provider">Email Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProvider && (
                <p className="text-sm text-muted-foreground">
                  {selectedProvider.description}
                </p>
              )}
            </div>

            {provider && provider !== "ses" && (
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <div className="relative">
                  <Input
                    id="apiKey"
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your API key"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {provider === "mailgun" && (
              <div className="space-y-2">
                <Label htmlFor="domain">Mailgun Domain</Label>
                <Input
                  id="domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="mg.yourdomain.com"
                />
              </div>
            )}

            {provider === "ses" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="accessKeyId">AWS Access Key ID</Label>
                  <Input
                    id="accessKeyId"
                    type="password"
                    value={accessKeyId}
                    onChange={(e) => setAccessKeyId(e.target.value)}
                    placeholder="AKIA..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secretAccessKey">AWS Secret Access Key</Label>
                  <Input
                    id="secretAccessKey"
                    type="password"
                    value={secretAccessKey}
                    onChange={(e) => setSecretAccessKey(e.target.value)}
                    placeholder="Enter your secret access key"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region">AWS Region</Label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                      <SelectItem value="us-east-2">US East (Ohio)</SelectItem>
                      <SelectItem value="us-west-1">US West (N. California)</SelectItem>
                      <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                      <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
                      <SelectItem value="eu-west-2">EU (London)</SelectItem>
                      <SelectItem value="eu-central-1">EU (Frankfurt)</SelectItem>
                      <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
                      <SelectItem value="ap-southeast-2">Asia Pacific (Sydney)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fromEmail">From Email</Label>
                <Input
                  id="fromEmail"
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="noreply@yourdomain.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fromName">From Name</Label>
                <Input
                  id="fromName"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Asset Tracker"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving || !provider || !fromEmail}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Email Configuration</CardTitle>
          <CardDescription>
            Send a test email to verify your configuration is working
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Enter email address to test"
              className="flex-1"
            />
            <Button
              onClick={handleTestConnection}
              disabled={isTesting || !testEmail || !provider}
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Test Email
            </Button>
          </div>

          {connectionStatus === "connected" && (
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Test email sent successfully! Check your inbox at {testEmail}
              </AlertDescription>
            </Alert>
          )}

          {connectionStatus === "failed" && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to send test email. Please check your configuration and try again.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provider Setup Guides</CardTitle>
          <CardDescription>
            Quick links to help you set up your email provider
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {EMAIL_PROVIDERS.map((p) => (
              <div
                key={p.id}
                className={`p-4 rounded-lg border ${
                  provider === p.id ? "border-primary bg-primary/5" : "border-default-200"
                }`}
              >
                <h4 className="font-medium">{p.name}</h4>
                <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
