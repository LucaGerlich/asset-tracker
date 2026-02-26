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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Shield, Key, Link, Save, Loader2, CheckCircle } from "lucide-react";

interface SSOSetting {
  id: string;
  key: string;
  value: string | null;
  type: string;
  description: string | null;
  isEncrypted: boolean;
}

export default function SSOSettingsTab() {
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // SSO Configuration
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [provider, setProvider] = useState<"saml" | "oidc">("saml");
  const [providerName, setProviderName] = useState("");

  // SAML Configuration
  const [entityId, setEntityId] = useState("");
  const [ssoUrl, setSsoUrl] = useState("");
  const [sloUrl, setSloUrl] = useState("");
  const [certificate, setCertificate] = useState("");
  const [signRequests, setSignRequests] = useState(false);

  // OIDC Configuration
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [discoveryUrl, setDiscoveryUrl] = useState("");
  const [authorizationUrl, setAuthorizationUrl] = useState("");
  const [tokenUrl, setTokenUrl] = useState("");
  const [scopes, setScopes] = useState("openid profile email");

  // Attribute Mapping
  const [emailAttribute, setEmailAttribute] = useState("email");
  const [firstNameAttribute, setFirstNameAttribute] = useState("firstName");
  const [lastNameAttribute, setLastNameAttribute] = useState("lastName");
  const [usernameAttribute, setUsernameAttribute] = useState("username");
  const [groupsAttribute, setGroupsAttribute] = useState("");

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/admin/settings/sso");
        if (response.ok) {
          const data: SSOSetting[] = await response.json();
          const getValue = (key: string) =>
            data.find((s) => s.key === key)?.value || "";

          setSsoEnabled(getValue("sso.enabled") === "true");
          setProvider(
            (getValue("sso.provider") as "saml" | "oidc") || "saml"
          );
          setProviderName(getValue("sso.providerName"));

          // SAML
          setEntityId(getValue("sso.entityId"));
          setSsoUrl(getValue("sso.ssoUrl"));
          setSloUrl(getValue("sso.sloUrl"));
          setCertificate(getValue("sso.certificate"));
          setSignRequests(getValue("sso.signRequests") === "true");

          // OIDC
          setClientId(getValue("sso.clientId"));
          setClientSecret(getValue("sso.clientSecret") ? "********" : "");
          setDiscoveryUrl(getValue("sso.discoveryUrl"));
          setAuthorizationUrl(getValue("sso.authorizationUrl"));
          setTokenUrl(getValue("sso.tokenUrl"));
          setScopes(getValue("sso.scopes") || "openid profile email");

          // Attribute Mapping
          setEmailAttribute(getValue("sso.attr.email") || "email");
          setFirstNameAttribute(
            getValue("sso.attr.firstName") || "firstName"
          );
          setLastNameAttribute(getValue("sso.attr.lastName") || "lastName");
          setUsernameAttribute(
            getValue("sso.attr.username") || "username"
          );
          setGroupsAttribute(getValue("sso.attr.groups"));
        }
      } catch {
        toast.error("Failed to load SSO settings");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const settings: Array<{ key: string; value: string }> = [
        { key: "sso.enabled", value: String(ssoEnabled) },
        { key: "sso.provider", value: provider },
        { key: "sso.providerName", value: providerName },
        // Attribute Mapping
        { key: "sso.attr.email", value: emailAttribute },
        { key: "sso.attr.firstName", value: firstNameAttribute },
        { key: "sso.attr.lastName", value: lastNameAttribute },
        { key: "sso.attr.username", value: usernameAttribute },
        { key: "sso.attr.groups", value: groupsAttribute },
      ];

      if (provider === "saml") {
        settings.push(
          { key: "sso.entityId", value: entityId },
          { key: "sso.ssoUrl", value: ssoUrl },
          { key: "sso.sloUrl", value: sloUrl },
          { key: "sso.certificate", value: certificate },
          { key: "sso.signRequests", value: String(signRequests) }
        );
      } else {
        settings.push(
          { key: "sso.clientId", value: clientId },
          {
            key: "sso.clientSecret",
            value: clientSecret !== "********" ? clientSecret : "",
          },
          { key: "sso.discoveryUrl", value: discoveryUrl },
          { key: "sso.authorizationUrl", value: authorizationUrl },
          { key: "sso.tokenUrl", value: tokenUrl },
          { key: "sso.scopes", value: scopes }
        );
      }

      const response = await fetch("/api/admin/settings/sso", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });

      if (response.ok) {
        toast.success("SSO settings saved successfully");
        if (clientSecret && clientSecret !== "********") {
          setClientSecret("********");
        }
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save SSO settings");
      }
    } catch {
      toast.error("Failed to save SSO settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    // Validate required fields based on provider type
    const missingFields: string[] = [];

    if (!providerName) missingFields.push("Provider Name");

    if (provider === "saml") {
      if (!entityId) missingFields.push("Entity ID / Issuer URL");
      if (!ssoUrl) missingFields.push("SSO URL / Login URL");
      if (!certificate) missingFields.push("Certificate");
    } else {
      if (!clientId) missingFields.push("Client ID");
      if (!clientSecret) missingFields.push("Client Secret");
      if (!discoveryUrl && !authorizationUrl)
        missingFields.push("Discovery URL or Authorization URL");
      if (!discoveryUrl && !tokenUrl)
        missingFields.push("Discovery URL or Token URL");
    }

    if (missingFields.length > 0) {
      toast.error(
        `Please fill in the following required fields: ${missingFields.join(", ")}`
      );
      return;
    }

    setIsTesting(true);
    try {
      // Validate URLs client-side first
      if (provider === "saml") {
        try {
          new URL(entityId);
          new URL(ssoUrl);
          if (sloUrl) new URL(sloUrl);
        } catch {
          toast.error(
            "One or more URLs are invalid. Please check Entity ID, SSO URL, and SLO URL."
          );
          setIsTesting(false);
          return;
        }
      } else {
        try {
          if (discoveryUrl) new URL(discoveryUrl);
          if (authorizationUrl) new URL(authorizationUrl);
          if (tokenUrl) new URL(tokenUrl);
        } catch {
          toast.error(
            "One or more URLs are invalid. Please check Discovery URL, Authorization URL, and Token URL."
          );
          setIsTesting(false);
          return;
        }

        // For OIDC with discovery URL, try to fetch the discovery document
        if (discoveryUrl) {
          try {
            const discoRes = await fetch(discoveryUrl);
            if (discoRes.ok) {
              const disco = await discoRes.json();
              toast.success(
                `OIDC Discovery successful. Found authorization endpoint: ${disco.authorization_endpoint ? "Yes" : "No"}, token endpoint: ${disco.token_endpoint ? "Yes" : "No"}`,
                { duration: 5000 }
              );
              setIsTesting(false);
              return;
            }
          } catch {
            // Discovery fetch failed — continue with basic validation
          }
        }
      }

      toast.success(
        "Configuration validated. All required fields are present and URLs are well-formed. Save settings and test with an actual login to verify the full flow.",
        { duration: 5000 }
      );
    } catch {
      toast.error("Configuration validation failed");
    } finally {
      setIsTesting(false);
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
      {/* SSO Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            SSO Configuration
          </CardTitle>
          <CardDescription>
            Enable and configure Single Sign-On for your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sso-enabled">Enable SSO</Label>
              <p className="text-sm text-muted-foreground">
                Allow users to sign in using an external identity provider
              </p>
            </div>
            <Switch
              id="sso-enabled"
              checked={ssoEnabled}
              onCheckedChange={setSsoEnabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-type">Provider Type</Label>
            <Select
              value={provider}
              onValueChange={(value: "saml" | "oidc") => setProvider(value)}
            >
              <SelectTrigger id="provider-type">
                <SelectValue placeholder="Select provider type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="saml">SAML 2.0</SelectItem>
                <SelectItem value="oidc">OpenID Connect</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-name">Provider Name</Label>
            <Input
              id="provider-name"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              placeholder="e.g., Okta, Azure AD, Google Workspace"
            />
            <p className="text-sm text-muted-foreground">
              A display name for the identity provider shown on the login page
            </p>
          </div>
        </CardContent>
      </Card>

      {/* SAML Configuration Card */}
      {provider === "saml" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              SAML Configuration
            </CardTitle>
            <CardDescription>
              Configure SAML 2.0 settings from your identity provider
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="entity-id">Entity ID / Issuer URL</Label>
              <Input
                id="entity-id"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="https://idp.example.com/metadata"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sso-url">SSO URL / Login URL</Label>
              <Input
                id="sso-url"
                value={ssoUrl}
                onChange={(e) => setSsoUrl(e.target.value)}
                placeholder="https://idp.example.com/sso/saml"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slo-url">SLO URL / Logout URL (optional)</Label>
              <Input
                id="slo-url"
                value={sloUrl}
                onChange={(e) => setSloUrl(e.target.value)}
                placeholder="https://idp.example.com/slo/saml"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="certificate">Certificate (X.509)</Label>
              <Textarea
                id="certificate"
                value={certificate}
                onChange={(e) => setCertificate(e.target.value)}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                rows={6}
                className="font-mono text-xs"
              />
              <p className="text-sm text-muted-foreground">
                Paste the X.509 certificate provided by your identity provider
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sign-requests">Sign Authentication Requests</Label>
                <p className="text-sm text-muted-foreground">
                  Sign SAML authentication requests sent to the identity provider
                </p>
              </div>
              <Switch
                id="sign-requests"
                checked={signRequests}
                onCheckedChange={setSignRequests}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* OIDC Configuration Card */}
      {provider === "oidc" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              OpenID Connect Configuration
            </CardTitle>
            <CardDescription>
              Configure OpenID Connect settings from your identity provider
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client-id">Client ID</Label>
              <Input
                id="client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="your-client-id"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-secret">Client Secret</Label>
              <Input
                id="client-secret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="your-client-secret"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discovery-url">
                Discovery URL / Well-known Endpoint
              </Label>
              <Input
                id="discovery-url"
                value={discoveryUrl}
                onChange={(e) => setDiscoveryUrl(e.target.value)}
                placeholder="https://idp.example.com/.well-known/openid-configuration"
              />
              <p className="text-sm text-muted-foreground">
                If provided, Authorization URL and Token URL will be auto-discovered
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="authorization-url">Authorization URL</Label>
              <Input
                id="authorization-url"
                value={authorizationUrl}
                onChange={(e) => setAuthorizationUrl(e.target.value)}
                placeholder="https://idp.example.com/oauth2/authorize"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="token-url">Token URL</Label>
              <Input
                id="token-url"
                value={tokenUrl}
                onChange={(e) => setTokenUrl(e.target.value)}
                placeholder="https://idp.example.com/oauth2/token"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scopes">Scopes</Label>
              <Input
                id="scopes"
                value={scopes}
                onChange={(e) => setScopes(e.target.value)}
                placeholder="openid profile email"
              />
              <p className="text-sm text-muted-foreground">
                Space-separated list of OAuth scopes to request
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attribute Mapping Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Attribute Mapping
          </CardTitle>
          <CardDescription>
            Map identity provider attributes to user profile fields
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="attr-email">Email Attribute</Label>
              <Input
                id="attr-email"
                value={emailAttribute}
                onChange={(e) => setEmailAttribute(e.target.value)}
                placeholder="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="attr-first-name">First Name Attribute</Label>
              <Input
                id="attr-first-name"
                value={firstNameAttribute}
                onChange={(e) => setFirstNameAttribute(e.target.value)}
                placeholder="firstName"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="attr-last-name">Last Name Attribute</Label>
              <Input
                id="attr-last-name"
                value={lastNameAttribute}
                onChange={(e) => setLastNameAttribute(e.target.value)}
                placeholder="lastName"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="attr-username">Username Attribute</Label>
              <Input
                id="attr-username"
                value={usernameAttribute}
                onChange={(e) => setUsernameAttribute(e.target.value)}
                placeholder="username"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="attr-groups">
              Groups / Roles Attribute (optional)
            </Label>
            <Input
              id="attr-groups"
              value={groupsAttribute}
              onChange={(e) => setGroupsAttribute(e.target.value)}
              placeholder="groups"
            />
            <p className="text-sm text-muted-foreground">
              Map a groups or roles claim to automatically assign user roles
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleTestConnection}
          disabled={isTesting || !ssoEnabled}
        >
          {isTesting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4 mr-2" />
          )}
          Test Connection
        </Button>
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
