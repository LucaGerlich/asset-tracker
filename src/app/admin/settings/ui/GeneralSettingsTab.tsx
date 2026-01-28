"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Building, Globe, Palette, Database } from "lucide-react";

interface GeneralSettingsTabProps {
  settings: Array<{
    id: string;
    key: string;
    value: string | null;
    type: string;
    description: string | null;
    isEncrypted: boolean;
  }>;
}

export default function GeneralSettingsTab({ settings }: GeneralSettingsTabProps) {
  const getSettingValue = (key: string) => settings.find((s) => s.key === key)?.value || "";

  const [isSaving, setIsSaving] = useState(false);
  const [generalSettings, setGeneralSettings] = useState({
    companyName: getSettingValue("company_name") || "Asset Tracker",
    companyLogo: getSettingValue("company_logo") || "",
    timezone: getSettingValue("timezone") || "UTC",
    dateFormat: getSettingValue("date_format") || "MM/DD/YYYY",
    currency: getSettingValue("currency") || "USD",
    defaultLanguage: getSettingValue("default_language") || "en",
    enableDemoMode: getSettingValue("demo_mode") === "true",
    autoLogoutMinutes: parseInt(getSettingValue("auto_logout_minutes")) || 0,
    requireStrongPasswords: getSettingValue("require_strong_passwords") !== "false",
    allowSelfRegistration: getSettingValue("allow_self_registration") === "true",
    maintenanceMode: getSettingValue("maintenance_mode") === "true",
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/settings/general", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generalSettings),
      });

      if (response.ok) {
        toast.success("General settings saved successfully");
      } else {
        toast.error("Failed to save settings");
      }
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Company Information
          </CardTitle>
          <CardDescription>
            Configure your organization's branding and identity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={generalSettings.companyName}
                onChange={(e) =>
                  setGeneralSettings({ ...generalSettings, companyName: e.target.value })
                }
                placeholder="Your Company Name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyLogo">Logo URL</Label>
              <Input
                id="companyLogo"
                value={generalSettings.companyLogo}
                onChange={(e) =>
                  setGeneralSettings({ ...generalSettings, companyLogo: e.target.value })
                }
                placeholder="https://example.com/logo.png"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Localization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Localization
          </CardTitle>
          <CardDescription>
            Configure regional and language preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={generalSettings.timezone}
                onChange={(e) =>
                  setGeneralSettings({ ...generalSettings, timezone: e.target.value })
                }
                placeholder="UTC"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateFormat">Date Format</Label>
              <Input
                id="dateFormat"
                value={generalSettings.dateFormat}
                onChange={(e) =>
                  setGeneralSettings({ ...generalSettings, dateFormat: e.target.value })
                }
                placeholder="MM/DD/YYYY"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={generalSettings.currency}
                onChange={(e) =>
                  setGeneralSettings({ ...generalSettings, currency: e.target.value })
                }
                placeholder="USD"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultLanguage">Language</Label>
              <Input
                id="defaultLanguage"
                value={generalSettings.defaultLanguage}
                onChange={(e) =>
                  setGeneralSettings({ ...generalSettings, defaultLanguage: e.target.value })
                }
                placeholder="en"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Security & Access
          </CardTitle>
          <CardDescription>
            Configure security policies and access controls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Require Strong Passwords</Label>
              <p className="text-sm text-muted-foreground">
                Enforce minimum password requirements (8+ chars, mixed case, numbers)
              </p>
            </div>
            <Switch
              checked={generalSettings.requireStrongPasswords}
              onCheckedChange={(checked) =>
                setGeneralSettings({ ...generalSettings, requireStrongPasswords: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Allow Self Registration</Label>
              <p className="text-sm text-muted-foreground">
                Allow new users to create their own accounts
              </p>
            </div>
            <Switch
              checked={generalSettings.allowSelfRegistration}
              onCheckedChange={(checked) =>
                setGeneralSettings({ ...generalSettings, allowSelfRegistration: checked })
              }
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="autoLogout">Auto Logout (minutes)</Label>
            <Input
              id="autoLogout"
              type="number"
              min={0}
              max={480}
              value={generalSettings.autoLogoutMinutes}
              onChange={(e) =>
                setGeneralSettings({
                  ...generalSettings,
                  autoLogoutMinutes: parseInt(e.target.value) || 0,
                })
              }
              className="w-32"
            />
            <p className="text-sm text-muted-foreground">
              Set to 0 to disable auto logout
            </p>
          </div>
        </CardContent>
      </Card>

      {/* System Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            System
          </CardTitle>
          <CardDescription>
            System-wide configuration options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Demo Mode</Label>
              <p className="text-sm text-muted-foreground">
                Enable demo mode with sample data and restricted functionality
              </p>
            </div>
            <Switch
              checked={generalSettings.enableDemoMode}
              onCheckedChange={(checked) =>
                setGeneralSettings({ ...generalSettings, enableDemoMode: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium text-yellow-600">Maintenance Mode</Label>
              <p className="text-sm text-muted-foreground">
                Put the application in maintenance mode (only admins can access)
              </p>
            </div>
            <Switch
              checked={generalSettings.maintenanceMode}
              onCheckedChange={(checked) =>
                setGeneralSettings({ ...generalSettings, maintenanceMode: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save All Settings
        </Button>
      </div>
    </div>
  );
}
