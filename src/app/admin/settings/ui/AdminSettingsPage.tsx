"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
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
import IntegrationsTab from "./IntegrationsTab";
import LocationTrackingTab from "./LocationTrackingTab";

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
    ],
  },
  {
    title: "Access & Security",
    items: [
      { value: "roles", label: "Roles", icon: Shield },
      { value: "sso", label: "SSO", icon: KeyRound },
      { value: "ldap", label: "LDAP", icon: Server },
      { value: "locationTracking", label: "Location Tracking", icon: MapPin },
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
    includeQR: boolean;
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
}

export default function AdminSettingsPage({
  settings,
  users,
  emailTemplates,
  labelTemplates,
  customFields,
  depreciationSettings,
  envEmailConfig,
}: AdminSettingsPageProps) {
  const [activeTab, setActiveTab] = useState("general");

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Admin Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Configure system settings, manage users, and customize the application
        </p>

        {/* Mobile dropdown */}
        <div className="mt-4 md:hidden">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="border-border bg-background w-full rounded-lg border px-3 py-2 text-sm font-medium"
          >
            {settingsNav.map((group) =>
              group.items.map((item) => (
                <option key={item.value} value={item.value}>
                  {group.title} — {item.label}
                </option>
              )),
            )}
          </select>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Sidebar navigation — sticky within the main scroll container */}
        <nav
          className="hidden w-56 shrink-0 md:block"
          aria-label="Settings navigation"
        >
          <div className="sticky top-0 max-h-[calc(100vh-8rem)] space-y-6 overflow-y-auto">
            {settingsNav.map((group) => (
              <div key={group.title}>
                <p className="text-muted-foreground/70 px-3 pb-1.5 text-[11px] font-semibold tracking-widest uppercase">
                  {group.title}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.value;
                    return (
                      <button
                        key={item.value}
                        onClick={() => setActiveTab(item.value)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary/8 text-foreground font-semibold"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* Content area */}
        <div className="min-w-0 flex-1">
          {activeTab === "general" && (
            <GeneralSettingsTab settings={settings.general || []} />
          )}
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
          {activeTab === "sso" && <SSOSettingsTab />}
          {activeTab === "ldap" && <LDAPSettingsTab />}
          {activeTab === "integrations" && <IntegrationsTab />}
          {activeTab === "locationTracking" && <LocationTrackingTab />}
        </div>
      </div>
    </div>
  );
}
