"use client";

import React, { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { FolderTree, Server, Save, Loader2, CheckCircle } from "lucide-react";

interface LDAPSetting {
  id: string;
  key: string;
  value: string | null;
  type: string;
  description: string | null;
  isEncrypted: boolean;
}

export default function LDAPSettingsTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Connection
  const [ldapEnabled, setLdapEnabled] = useState(false);
  const [serverUrl, setServerUrl] = useState("");
  const [port, setPort] = useState("389");
  const [useTLS, setUseTLS] = useState(false);
  const [bindDN, setBindDN] = useState("");
  const [bindPassword, setBindPassword] = useState("");

  // Search
  const [searchBase, setSearchBase] = useState("");
  const [userFilter, setUserFilter] = useState("(objectClass=user)");
  const [groupFilter, setGroupFilter] = useState("(objectClass=group)");

  // Attribute Mapping
  const [usernameAttr, setUsernameAttr] = useState("sAMAccountName");
  const [emailAttr, setEmailAttr] = useState("mail");
  const [firstNameAttr, setFirstNameAttr] = useState("givenName");
  const [lastNameAttr, setLastNameAttr] = useState("sn");
  const [groupMemberAttr, setGroupMemberAttr] = useState("memberOf");

  // Sync
  const [syncInterval, setSyncInterval] = useState("60");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [autoCreateUsers, setAutoCreateUsers] = useState(true);
  const [autoDeactivateUsers, setAutoDeactivateUsers] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/admin/settings/ldap");
        if (response.ok) {
          const data: LDAPSetting[] = await response.json();
          const getValue = (key: string) =>
            data.find((s) => s.key === key)?.value || "";

          setLdapEnabled(getValue("ldap.enabled") === "true");
          setServerUrl(getValue("ldap.serverUrl"));
          setPort(getValue("ldap.port") || "389");
          setUseTLS(getValue("ldap.useTLS") === "true");
          setBindDN(getValue("ldap.bindDN"));
          setBindPassword(getValue("ldap.bindPassword") ? "********" : "");

          setSearchBase(getValue("ldap.searchBase"));
          setUserFilter(getValue("ldap.userFilter") || "(objectClass=user)");
          setGroupFilter(getValue("ldap.groupFilter") || "(objectClass=group)");

          setUsernameAttr(getValue("ldap.attr.username") || "sAMAccountName");
          setEmailAttr(getValue("ldap.attr.email") || "mail");
          setFirstNameAttr(getValue("ldap.attr.firstName") || "givenName");
          setLastNameAttr(getValue("ldap.attr.lastName") || "sn");
          setGroupMemberAttr(getValue("ldap.attr.groupMember") || "memberOf");

          setSyncInterval(getValue("ldap.syncInterval") || "60");
          setSyncEnabled(getValue("ldap.syncEnabled") === "true");
          setAutoCreateUsers(getValue("ldap.autoCreateUsers") !== "false");
          setAutoDeactivateUsers(getValue("ldap.autoDeactivateUsers") === "true");
        }
      } catch {
        toast.error("Failed to load LDAP settings");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const settings = [
        { key: "ldap.enabled", value: String(ldapEnabled) },
        { key: "ldap.serverUrl", value: serverUrl },
        { key: "ldap.port", value: port },
        { key: "ldap.useTLS", value: String(useTLS) },
        { key: "ldap.bindDN", value: bindDN },
        { key: "ldap.searchBase", value: searchBase },
        { key: "ldap.userFilter", value: userFilter },
        { key: "ldap.groupFilter", value: groupFilter },
        { key: "ldap.attr.username", value: usernameAttr },
        { key: "ldap.attr.email", value: emailAttr },
        { key: "ldap.attr.firstName", value: firstNameAttr },
        { key: "ldap.attr.lastName", value: lastNameAttr },
        { key: "ldap.attr.groupMember", value: groupMemberAttr },
        { key: "ldap.syncInterval", value: syncInterval },
        { key: "ldap.syncEnabled", value: String(syncEnabled) },
        { key: "ldap.autoCreateUsers", value: String(autoCreateUsers) },
        { key: "ldap.autoDeactivateUsers", value: String(autoDeactivateUsers) },
      ];

      if (bindPassword && bindPassword !== "********") {
        settings.push({ key: "ldap.bindPassword", value: bindPassword });
      }

      const response = await fetch("/api/admin/settings/ldap", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });

      if (response.ok) {
        toast.success("LDAP settings saved successfully");
        if (bindPassword && bindPassword !== "********") {
          setBindPassword("********");
        }
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save LDAP settings");
      }
    } catch {
      toast.error("Failed to save LDAP settings");
    } finally {
      setIsSaving(false);
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const handleTestConnection = async () => {
    const missingFields: string[] = [];
    if (!serverUrl) missingFields.push("Server URL");
    if (!bindDN) missingFields.push("Bind DN");
    if (!bindPassword) missingFields.push("Bind Password");
    if (!searchBase) missingFields.push("Search Base");

    if (missingFields.length > 0) {
      toast.error(
        `Please fill in required fields: ${missingFields.join(", ")}`
      );
      return;
    }

    setIsTesting(true);
    try {
      const res = await fetch("/api/admin/settings/ldap/test", {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.message, { duration: 5000 });
      } else {
        toast.error(data.message || "Connection test failed");
      }
    } catch {
      toast.error("Connection test failed");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/admin/settings/ldap/sync", {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        toast.success(
          `Sync complete: ${data.created} created, ${data.updated} updated, ${data.deactivated} deactivated`,
          { duration: 5000 }
        );
      } else {
        toast.error(data.errors?.[0] || "Sync failed");
      }
    } catch {
      toast.error("Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            LDAP / Active Directory Connection
          </CardTitle>
          <CardDescription>
            Configure connection to your LDAP or Active Directory server
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ldap-enabled">Enable LDAP</Label>
              <p className="text-sm text-muted-foreground">
                Enable LDAP/AD authentication and user sync
              </p>
            </div>
            <Switch
              id="ldap-enabled"
              checked={ldapEnabled}
              onCheckedChange={setLdapEnabled}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ldap-server">Server URL</Label>
              <Input
                id="ldap-server"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="ldap://dc.example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ldap-port">Port</Label>
              <Select value={port} onValueChange={setPort}>
                <SelectTrigger id="ldap-port">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="389">389 (LDAP)</SelectItem>
                  <SelectItem value="636">636 (LDAPS)</SelectItem>
                  <SelectItem value="3268">3268 (Global Catalog)</SelectItem>
                  <SelectItem value="3269">3269 (Global Catalog SSL)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ldap-tls">Use TLS / StartTLS</Label>
              <p className="text-sm text-muted-foreground">
                Encrypt the connection using TLS
              </p>
            </div>
            <Switch
              id="ldap-tls"
              checked={useTLS}
              onCheckedChange={setUseTLS}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ldap-bind-dn">Bind DN</Label>
            <Input
              id="ldap-bind-dn"
              value={bindDN}
              onChange={(e) => setBindDN(e.target.value)}
              placeholder="CN=service-account,OU=Service Accounts,DC=example,DC=com"
            />
            <p className="text-sm text-muted-foreground">
              Distinguished name of the service account used to bind
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ldap-bind-password">Bind Password</Label>
            <Input
              id="ldap-bind-password"
              type="password"
              value={bindPassword}
              onChange={(e) => setBindPassword(e.target.value)}
              placeholder="Service account password"
            />
          </div>
        </CardContent>
      </Card>

      {/* Search Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            Search Configuration
          </CardTitle>
          <CardDescription>
            Configure how users and groups are discovered in the directory
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ldap-search-base">Search Base (Base DN)</Label>
            <Input
              id="ldap-search-base"
              value={searchBase}
              onChange={(e) => setSearchBase(e.target.value)}
              placeholder="DC=example,DC=com"
            />
            <p className="text-sm text-muted-foreground">
              The base DN to search for users and groups
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ldap-user-filter">User Filter</Label>
            <Input
              id="ldap-user-filter"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              placeholder="(objectClass=user)"
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ldap-group-filter">Group Filter</Label>
            <Input
              id="ldap-group-filter"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              placeholder="(objectClass=group)"
              className="font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Attribute Mapping */}
      <Card>
        <CardHeader>
          <CardTitle>Attribute Mapping</CardTitle>
          <CardDescription>
            Map LDAP attributes to user profile fields
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ldap-attr-username">Username Attribute</Label>
              <Input
                id="ldap-attr-username"
                value={usernameAttr}
                onChange={(e) => setUsernameAttr(e.target.value)}
                placeholder="sAMAccountName"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ldap-attr-email">Email Attribute</Label>
              <Input
                id="ldap-attr-email"
                value={emailAttr}
                onChange={(e) => setEmailAttr(e.target.value)}
                placeholder="mail"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ldap-attr-firstname">First Name Attribute</Label>
              <Input
                id="ldap-attr-firstname"
                value={firstNameAttr}
                onChange={(e) => setFirstNameAttr(e.target.value)}
                placeholder="givenName"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ldap-attr-lastname">Last Name Attribute</Label>
              <Input
                id="ldap-attr-lastname"
                value={lastNameAttr}
                onChange={(e) => setLastNameAttr(e.target.value)}
                placeholder="sn"
              />
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <Label htmlFor="ldap-attr-group">Group Membership Attribute</Label>
            <Input
              id="ldap-attr-group"
              value={groupMemberAttr}
              onChange={(e) => setGroupMemberAttr(e.target.value)}
              placeholder="memberOf"
            />
            <p className="text-sm text-muted-foreground">
              Used to map LDAP groups to application roles
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Sync Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Settings</CardTitle>
          <CardDescription>
            Configure automatic user synchronization from the directory
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ldap-sync-enabled">Enable Auto Sync</Label>
              <p className="text-sm text-muted-foreground">
                Periodically sync users from the directory
              </p>
            </div>
            <Switch
              id="ldap-sync-enabled"
              checked={syncEnabled}
              onCheckedChange={setSyncEnabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ldap-sync-interval">Sync Interval (minutes)</Label>
            <Input
              id="ldap-sync-interval"
              type="number"
              min={5}
              max={1440}
              value={syncInterval}
              onChange={(e) => setSyncInterval(e.target.value)}
              className="w-32"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ldap-auto-create">Auto-Create Users</Label>
              <p className="text-sm text-muted-foreground">
                Automatically create new user accounts for directory users
              </p>
            </div>
            <Switch
              id="ldap-auto-create"
              checked={autoCreateUsers}
              onCheckedChange={setAutoCreateUsers}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ldap-auto-deactivate">
                Auto-Deactivate Users
              </Label>
              <p className="text-sm text-muted-foreground">
                Deactivate users no longer found in the directory
              </p>
            </div>
            <Switch
              id="ldap-auto-deactivate"
              checked={autoDeactivateUsers}
              onCheckedChange={setAutoDeactivateUsers}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={isTesting || !ldapEnabled}
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Test Connection
          </Button>
          <Button
            variant="outline"
            onClick={handleSyncNow}
            disabled={isSyncing || !ldapEnabled}
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Server className="h-4 w-4 mr-2" />
            )}
            Sync Now
          </Button>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
