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
} from "lucide-react";
import EmailSettingsTab from "./EmailSettingsTab";
import UsersSettingsTab from "./UsersSettingsTab";
import LabelSettingsTab from "./LabelSettingsTab";
import DepreciationSettingsTab from "./DepreciationSettingsTab";
import CustomFieldsTab from "./CustomFieldsTab";
import NotificationSettingsTab from "./NotificationSettingsTab";
import GeneralSettingsTab from "./GeneralSettingsTab";

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
    category: {
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
        <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 h-auto p-1">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Email</span>
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
          <TabsTrigger value="customFields" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Custom Fields</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="general">
            <GeneralSettingsTab settings={settings.general || []} />
          </TabsContent>

          <TabsContent value="email">
            <EmailSettingsTab settings={settings.email || []} />
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

          <TabsContent value="customFields">
            <CustomFieldsTab fields={customFields} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
