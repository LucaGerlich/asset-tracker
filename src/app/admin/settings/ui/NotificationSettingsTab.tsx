"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Bell, Mail, AlertTriangle, Wrench, Package } from "lucide-react";

interface NotificationSettingsTabProps {
  settings: Array<{
    id: string;
    key: string;
    value: string | null;
    type: string;
    description: string | null;
    isEncrypted: boolean;
  }>;
}

export default function NotificationSettingsTab({ settings }: NotificationSettingsTabProps) {
  const getSettingValue = (key: string) => settings.find((s) => s.key === key)?.value || "";

  const [isSaving, setIsSaving] = useState(false);
  const [notifications, setNotifications] = useState({
    enableAssignmentEmails: getSettingValue("notify_assignments") === "true",
    enableUnassignmentEmails: getSettingValue("notify_unassignments") === "true",
    enableLicenseExpiryEmails: getSettingValue("notify_license_expiry") === "true",
    enableMaintenanceEmails: getSettingValue("notify_maintenance") === "true",
    enableLowStockEmails: getSettingValue("notify_low_stock") === "true",
    enableWarrantyEmails: getSettingValue("notify_warranty_expiry") === "true",
    licenseExpiryDays: parseInt(getSettingValue("license_expiry_days")) || 30,
    maintenanceReminderDays: parseInt(getSettingValue("maintenance_reminder_days")) || 7,
    lowStockThreshold: parseInt(getSettingValue("low_stock_threshold")) || 10,
    warrantyExpiryDays: parseInt(getSettingValue("warranty_expiry_days")) || 30,
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/settings/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notifications),
      });

      if (response.ok) {
        toast.success("Notification settings saved successfully");
      } else {
        toast.error("Failed to save notification settings");
      }
    } catch (error) {
      toast.error("Failed to save notification settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email Notification Settings
          </CardTitle>
          <CardDescription>
            Configure when and how email notifications are sent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Assignment Notifications */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <Label className="font-medium">Asset Assignment Notifications</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Send emails when assets are assigned to users
                </p>
              </div>
              <Switch
                checked={notifications.enableAssignmentEmails}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, enableAssignmentEmails: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <Label className="font-medium">Asset Unassignment Notifications</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Send emails when assets are unassigned from users
                </p>
              </div>
              <Switch
                checked={notifications.enableUnassignmentEmails}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, enableUnassignmentEmails: checked })
                }
              />
            </div>
          </div>

          <Separator />

          {/* License Expiry Notifications */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <Label className="font-medium">License Expiry Alerts</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Notify users when their assigned licenses are about to expire
                </p>
              </div>
              <Switch
                checked={notifications.enableLicenseExpiryEmails}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, enableLicenseExpiryEmails: checked })
                }
              />
            </div>

            {notifications.enableLicenseExpiryEmails && (
              <div className="ml-6 space-y-2">
                <Label>Days before expiry to notify</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={notifications.licenseExpiryDays}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      licenseExpiryDays: parseInt(e.target.value) || 30,
                    })
                  }
                  className="w-32"
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Maintenance Notifications */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-blue-500" />
                  <Label className="font-medium">Maintenance Reminders</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Send reminders for upcoming scheduled maintenance
                </p>
              </div>
              <Switch
                checked={notifications.enableMaintenanceEmails}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, enableMaintenanceEmails: checked })
                }
              />
            </div>

            {notifications.enableMaintenanceEmails && (
              <div className="ml-6 space-y-2">
                <Label>Days before due date to remind</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={notifications.maintenanceReminderDays}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      maintenanceReminderDays: parseInt(e.target.value) || 7,
                    })
                  }
                  className="w-32"
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Low Stock Notifications */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-red-500" />
                  <Label className="font-medium">Low Stock Alerts</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Notify admins when consumable stock falls below threshold
                </p>
              </div>
              <Switch
                checked={notifications.enableLowStockEmails}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, enableLowStockEmails: checked })
                }
              />
            </div>

            {notifications.enableLowStockEmails && (
              <div className="ml-6 space-y-2">
                <Label>Default minimum stock threshold</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={notifications.lowStockThreshold}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      lowStockThreshold: parseInt(e.target.value) || 10,
                    })
                  }
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">
                  This can be overridden per consumable item
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Warranty Notifications */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <Label className="font-medium">Warranty Expiry Alerts</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Notify admins when asset warranties are about to expire
                </p>
              </div>
              <Switch
                checked={notifications.enableWarrantyEmails}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, enableWarrantyEmails: checked })
                }
              />
            </div>

            {notifications.enableWarrantyEmails && (
              <div className="ml-6 space-y-2">
                <Label>Days before warranty expiry to notify</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={notifications.warrantyExpiryDays}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      warrantyExpiryDays: parseInt(e.target.value) || 30,
                    })
                  }
                  className="w-32"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Schedule</CardTitle>
          <CardDescription>
            Automated notifications are processed periodically. Configure a cron job or scheduled task
            to run the notification processor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm font-mono">
              # Add to your crontab to process notifications daily at 8 AM:<br />
              0 8 * * * curl -X POST {typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/cron/notifications
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
