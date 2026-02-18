"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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
}

export default function AdminSettingsPage({
  settings,
  users,
  emailTemplates,
  labelTemplates,
  customFields,
  depreciationSettings,
}: AdminSettingsPageProps) {
  const [activeTab, setActiveTab] = useState("general");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin Settings</h1>
        <p className="text-sm text-foreground-500 mt-1">
          Configure system settings, manage users, and customize the application
        </p>
      </div>

      <Separator />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap gap-2 h-auto p-1">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Email</span>
          </TabsTrigger>
          <TabsTrigger value="freshdesk" className="flex items-center gap-2">
            <Ticket className="h-4 w-4" />
            <span className="hidden sm:inline">Freshdesk</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
          <TabsTrigger value="labels" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Labels</span>
          </TabsTrigger>
          <TabsTrigger value="depreciation" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline">Depreciation</span>
          </TabsTrigger>
          <TabsTrigger value="custom-fields" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Custom Fields</span>
          </TabsTrigger>
          <TabsTrigger value="organizations" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Organizations</span>
          </TabsTrigger>
          <TabsTrigger value="departments" className="flex items-center gap-2">
            <FolderTree className="h-4 w-4" />
            <span className="hidden sm:inline">Departments</span>
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Roles</span>
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            <span className="hidden sm:inline">Webhooks</span>
          </TabsTrigger>
          <TabsTrigger value="sso" className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            <span className="hidden sm:inline">SSO</span>
          </TabsTrigger>
          <TabsTrigger value="ldap" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            <span className="hidden sm:inline">LDAP</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Integrations</span>
          </TabsTrigger>
          <TabsTrigger value="locationTracking" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Location Tracking</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="general">
            <GeneralSettingsTab settings={settings.general || []} />
          </TabsContent>

          <TabsContent value="email">
            <EmailSettingsTab settings={settings.email || []} />
          </TabsContent>

          <TabsContent value="freshdesk">
            <FreshdeskSettingsTab settings={settings.freshdesk || []} />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationSettingsTab settings={settings.notifications || []} />
          </TabsContent>

          <TabsContent value="users">
            <UsersSettingsTab users={users} />
          </TabsContent>

          <TabsContent value="labels">
            <LabelSettingsTab templates={labelTemplates} />
          </TabsContent>

          <TabsContent value="depreciation">
            <DepreciationSettingsTab settings={depreciationSettings} />
          </TabsContent>

          <TabsContent value="custom-fields">
            <CustomFieldsAdminTab />
          </TabsContent>

          <TabsContent value="organizations">
            <OrganizationsTab />
          </TabsContent>

          <TabsContent value="departments">
            <DepartmentsTab />
          </TabsContent>

          <TabsContent value="roles">
            <RolesTab />
          </TabsContent>

          <TabsContent value="webhooks">
            <WebhooksTab />
          </TabsContent>

          <TabsContent value="sso">
            <SSOSettingsTab />
          </TabsContent>

          <TabsContent value="ldap">
            <LDAPSettingsTab />
          </TabsContent>

          <TabsContent value="integrations">
            <IntegrationsTab />
          </TabsContent>

          <TabsContent value="locationTracking">
            <LocationTrackingTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
