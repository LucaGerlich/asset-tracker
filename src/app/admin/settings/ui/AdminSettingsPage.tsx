"use client";

import React, { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Settings,
  Mail,
  Users,
  Tag,
  Calculator,
  FileText,
  Bell,
  Shield,
  Ticket,
  Building2,
  FolderTree,
  Webhook,
  KeyRound,
  Server,
  MessageSquare,
  MapPin,
  Gauge,
  GitBranch,
  FileKey,
  ScrollText,
  LayoutTemplate,
  Monitor,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import EmailSettingsTab from "./EmailSettingsTab";
import UsersSettingsTab from "./UsersSettingsTab";
import LabelSettingsTab from "./LabelSettingsTab";
import DepreciationSettingsTab from "./DepreciationSettingsTab";
import CustomFieldsAdminTab from "./CustomFieldsAdminTab";
import NotificationSettingsTab from "./NotificationSettingsTab";
import GeneralSettingsTab from "./GeneralSettingsTab";
import FreshdeskSettingsTab from "./FreshdeskSettingsTab";
import OrganizationsTab from "./OrganizationsTab";
import DepartmentsTab from "./DepartmentsTab";
import RolesTab from "./RolesTab";
import WebhooksTab from "./WebhooksTab";
import SSOSettingsTab from "./SSOSettingsTab";
import LDAPSettingsTab from "./LDAPSettingsTab";
import IntuneSettingsTab from "./IntuneSettingsTab";
import IntegrationsTab from "./IntegrationsTab";
import LocationTrackingTab from "./LocationTrackingTab";
import RateLimitTab from "./RateLimitTab";
import StatusWorkflowTab from "./StatusWorkflowTab";
import ApiKeysTab from "./ApiKeysTab";
import EulaTab from "./EulaTab";
import AssetTemplatesTab from "./AssetTemplatesTab";
import { PlanGate } from "@/components/PlanGate";
import BillingTab from "./BillingTab";
import { CreditCard } from "lucide-react";

interface NavItem {
  value: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const settingsNav: NavGroup[] = [
  {
    title: "General",
    items: [
      { value: "general", label: "General", icon: Settings },
      { value: "users", label: "Users", icon: Users },
      { value: "billing", label: "Billing", icon: CreditCard },
    ],
  },
  {
    title: "Communication",
    items: [
      { value: "email", label: "Email", icon: Mail },
      { value: "notifications", label: "Notifications", icon: Bell },
      { value: "labels", label: "Labels", icon: Tag },
    ],
  },
  {
    title: "Asset Configuration",
    items: [
      { value: "depreciation", label: "Depreciation", icon: Calculator },
      { value: "custom-fields", label: "Custom Fields", icon: FileText },
      { value: "status-workflow", label: "Status Workflow", icon: GitBranch },
      {
        value: "asset-templates",
        label: "Asset Templates",
        icon: LayoutTemplate,
      },
      { value: "eula", label: "EULA Templates", icon: ScrollText },
    ],
  },
  {
    title: "Access & Security",
    items: [
      { value: "roles", label: "Roles", icon: Shield },
      { value: "api-keys", label: "API Keys", icon: FileKey },
      { value: "sso", label: "SSO", icon: KeyRound },
      { value: "ldap", label: "LDAP", icon: Server },
      { value: "intune", label: "Intune", icon: Monitor },
      { value: "locationTracking", label: "Location Tracking", icon: MapPin },
      { value: "rateLimits", label: "Rate Limits", icon: Gauge },
    ],
  },
  {
    title: "Integrations",
    items: [
      { value: "freshdesk", label: "Freshdesk", icon: Ticket },
      { value: "webhooks", label: "Webhooks", icon: Webhook },
      { value: "integrations", label: "Integrations", icon: MessageSquare },
      { value: "organizations", label: "Organizations", icon: Building2 },
      { value: "departments", label: "Departments", icon: FolderTree },
    ],
  },
];

const SUPER_ADMIN_ONLY_TABS = new Set(["organizations"]);
const SELF_HOSTED_HIDDEN_TABS = new Set(["billing"]);

interface AdminSettingsPageProps {
  settings: Record<
    string,
    Array<{
      id: string;
      key: string;
      value: string | null;
      type: string;
      description: string | null;
      isEncrypted: boolean;
    }>
  >;
  users: Array<{
    userid: string;
    username: string | null;
    firstname: string;
    lastname: string;
    email: string | null;
    isadmin: boolean;
    canrequest: boolean;
    creation_date: Date;
  }>;
  emailTemplates: Array<{
    id: string;
    name: string;
    subject: string;
    body: string;
    isActive: boolean;
  }>;
  labelTemplates: Array<{
    id: string;
    name: string;
    width: unknown;
    height: unknown;
    layout: string;
    fields: string;
    includeQR: boolean;
    includeLogo: boolean;
    isDefault: boolean;
  }>;
  customFields: Array<{
    id: string;
    name: string;
    fieldType: string;
    entityType: string;
    isRequired: boolean;
    isActive: boolean;
  }>;
  depreciationSettings: Array<{
    id: string;
    categoryId: string;
    method: string;
    usefulLifeYears: number;
    salvagePercent: unknown;
    assetCategoryType: {
      assetcategorytypeid: string;
      assetcategorytypename: string;
    };
  }>;
  envEmailConfig?: {
    provider: string;
    fromEmail: string;
    fromName: string;
    hasApiKey: boolean;
  } | null;
  statuses?: Array<{
    statustypeid: string;
    statustypename: string;
  }>;
  isSuperAdmin?: boolean;
  orgPlan?: "starter" | "professional" | "enterprise";
  isSelfHostedMode?: boolean;
}

export default function AdminSettingsPage({
  settings,
  users,
  emailTemplates,
  labelTemplates,
  customFields,
  depreciationSettings,
  envEmailConfig,
  statuses = [],
  isSuperAdmin = false,
  orgPlan = "starter",
  isSelfHostedMode = false,
}: AdminSettingsPageProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") || "general",
  );

  const filteredNav = useMemo(
    () =>
      settingsNav
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            if (SUPER_ADMIN_ONLY_TABS.has(item.value) && !isSuperAdmin)
              return false;
            if (SELF_HOSTED_HIDDEN_TABS.has(item.value) && isSelfHostedMode)
              return false;
            return true;
          }),
        }))
        .filter((group) => group.items.length > 0),
    [isSuperAdmin, isSelfHostedMode],
  );

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col">
      {/* Header — fixed, never scrolls */}
      <div className="shrink-0 pb-4">
        <h1 className="text-2xl font-semibold">Admin Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Configure system settings, manage users, and customize the application
        </p>

        {/* Mobile dropdown */}
        <div className="mt-4 md:hidden">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full text-sm font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filteredNav.map((group) =>
                group.items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {group.title} — {item.label}
                  </SelectItem>
                )),
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-8">
        {/* Sidebar navigation — independently scrollable */}
        <nav
          className="hidden w-56 shrink-0 md:block"
          aria-label="Settings navigation"
        >
          <div className="h-full space-y-6 overflow-y-auto">
            {filteredNav.map((group) => (
              <div key={group.title}>
                <p className="text-muted-foreground/70 px-3 pb-1.5 text-[11px] font-semibold tracking-widest uppercase">
                  {group.title}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.value;
                    return (
                      <Button
                        key={item.value}
                        variant="ghost"
                        onClick={() => setActiveTab(item.value)}
                        className={cn(
                          "flex w-full items-center justify-start gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary/8 text-foreground font-semibold"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* Content area — independently scrollable */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          {activeTab === "general" && (
            <GeneralSettingsTab settings={settings.general || []} />
          )}
          {activeTab === "billing" && <BillingTab />}
          {activeTab === "email" && (
            <EmailSettingsTab
              settings={settings.email || []}
              envEmailConfig={envEmailConfig}
            />
          )}
          {activeTab === "freshdesk" && (
            <FreshdeskSettingsTab settings={settings.freshdesk || []} />
          )}
          {activeTab === "notifications" && (
            <NotificationSettingsTab settings={settings.notifications || []} />
          )}
          {activeTab === "users" && <UsersSettingsTab users={users} />}
          {activeTab === "labels" && (
            <LabelSettingsTab templates={labelTemplates} />
          )}
          {activeTab === "depreciation" && (
            <DepreciationSettingsTab settings={depreciationSettings} />
          )}
          {activeTab === "custom-fields" && <CustomFieldsAdminTab />}
          {activeTab === "organizations" && <OrganizationsTab />}
          {activeTab === "departments" && <DepartmentsTab />}
          {activeTab === "roles" && <RolesTab />}
          {activeTab === "webhooks" && <WebhooksTab />}
          {activeTab === "sso" && (
            <PlanGate
              feature="sso"
              plan={orgPlan}
              isSelfHosted={isSelfHostedMode}
            >
              <SSOSettingsTab />
            </PlanGate>
          )}
          {activeTab === "ldap" && (
            <PlanGate
              feature="ldap"
              plan={orgPlan}
              isSelfHosted={isSelfHostedMode}
            >
              <LDAPSettingsTab />
            </PlanGate>
          )}
          {activeTab === "intune" && <IntuneSettingsTab />}
          {activeTab === "integrations" && <IntegrationsTab />}
          {activeTab === "locationTracking" && <LocationTrackingTab />}
          {activeTab === "rateLimits" && <RateLimitTab />}
          {activeTab === "status-workflow" && (
            <StatusWorkflowTab statuses={statuses} />
          )}
          {activeTab === "api-keys" && (
            <PlanGate
              feature="api_keys"
              plan={orgPlan}
              isSelfHosted={isSelfHostedMode}
            >
              <ApiKeysTab />
            </PlanGate>
          )}
          {activeTab === "eula" && <EulaTab />}
          {activeTab === "asset-templates" && <AssetTemplatesTab />}
        </div>
      </div>
    </div>
  );
}
