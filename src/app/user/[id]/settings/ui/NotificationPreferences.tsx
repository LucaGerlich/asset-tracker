"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Bell } from "lucide-react";

interface NotificationPrefs {
  emailAssignments: boolean;
  emailUnassignments: boolean;
  emailLicenseExpiry: boolean;
  emailMaintenanceDue: boolean;
  emailLowStock: boolean;
}

const TOGGLE_OPTIONS: Array<{
  key: keyof NotificationPrefs;
  label: string;
  description: string;
}> = [
  {
    key: "emailAssignments",
    label: "Asset assignment",
    description: "Receive an email when an asset is assigned to you",
  },
  {
    key: "emailUnassignments",
    label: "Asset unassignment",
    description: "Receive an email when an asset is unassigned from you",
  },
  {
    key: "emailLicenseExpiry",
    label: "Licence expiry",
    description: "Receive an email when a licence is about to expire",
  },
  {
    key: "emailMaintenanceDue",
    label: "Maintenance due",
    description: "Receive an email when scheduled maintenance is due",
  },
  {
    key: "emailLowStock",
    label: "Low stock",
    description:
      "Receive an email when consumable stock drops below the threshold",
  },
];

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    emailAssignments: true,
    emailUnassignments: true,
    emailLicenseExpiry: true,
    emailMaintenanceDue: true,
    emailLowStock: false,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const res = await fetch("/api/user/notification-preferences");
        if (res.ok) {
          const data = await res.json();
          setPrefs({
            emailAssignments: Boolean(data.emailAssignments),
            emailUnassignments: Boolean(data.emailUnassignments),
            emailLicenseExpiry: Boolean(data.emailLicenseExpiry),
            emailMaintenanceDue: Boolean(data.emailMaintenanceDue),
            emailLowStock: Boolean(data.emailLowStock),
          });
        }
      } catch {
        // Use defaults on error
      } finally {
        setLoaded(true);
      }
    };
    fetchPrefs();
  }, []);

  const handleToggle = async (key: keyof NotificationPrefs, value: boolean) => {
    const previous = prefs[key];
    setPrefs((p) => ({ ...p, [key]: value }));

    try {
      const res = await fetch("/api/user/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) {
        throw new Error("Failed to save");
      }
      toast.success("Notification preference updated");
    } catch {
      setPrefs((p) => ({ ...p, [key]: previous }));
      toast.error("Failed to update notification preference");
    }
  };

  if (!loaded) {
    return (
      <section className="border-default-200 rounded-lg border p-4">
        <h2 className="text-foreground-600 mb-3 flex items-center gap-2 text-sm font-semibold">
          <Bell className="h-4 w-4" />
          Notifications
        </h2>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </section>
    );
  }

  return (
    <section className="border-default-200 rounded-lg border p-4">
      <h2 className="text-foreground-600 mb-3 flex items-center gap-2 text-sm font-semibold">
        <Bell className="h-4 w-4" />
        Notifications
      </h2>
      <p className="text-muted-foreground mb-4 text-sm">
        Choose which email notifications you want to receive.
      </p>
      <div className="space-y-4">
        {TOGGLE_OPTIONS.map((opt) => (
          <div
            key={opt.key}
            className="flex items-center justify-between gap-4"
          >
            <div className="flex-1">
              <Label htmlFor={opt.key} className="text-sm font-medium">
                {opt.label}
              </Label>
              <p className="text-muted-foreground text-xs">{opt.description}</p>
            </div>
            <Switch
              id={opt.key}
              checked={prefs[opt.key]}
              onCheckedChange={(checked) => handleToggle(opt.key, checked)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
