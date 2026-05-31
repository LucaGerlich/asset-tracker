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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MessageSquare, Save, Loader2, Send } from "lucide-react";

interface IntegrationSetting {
  id: string;
  key: string;
  value: string | null;
}

const SLACK_WEBHOOK_PLACEHOLDER =
  "https://hooks.slack.com/services/T00000/B00000/XXXX";
const TEAMS_WEBHOOK_PLACEHOLDER = "https://outlook.office.com/webhook/...";

const NOTIFICATION_EVENTS = [
  { key: "asset.created", label: "Asset Created" },
  { key: "asset.updated", label: "Asset Updated" },
  { key: "asset.assigned", label: "Asset Assigned" },
  { key: "consumable.low_stock", label: "Consumable Low Stock" },
  { key: "consumable.critical_stock", label: "Consumable Critical Stock" },
  { key: "maintenance.due", label: "Maintenance Due" },
  { key: "license.expiring", label: "License Expiring" },
  { key: "user.created", label: "User Created" },
  { key: "import.completed", label: "Import Completed" },
  { key: "import.failed", label: "Import Failed" },
];

export default function IntegrationsTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Slack
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [slackChannel, setSlackChannel] = useState("");
  const [slackEvents, setSlackEvents] = useState<string[]>([]);
  const [isTestingSlack, setIsTestingSlack] = useState(false);

  // Teams
  const [teamsEnabled, setTeamsEnabled] = useState(false);
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState("");
  const [teamsEvents, setTeamsEvents] = useState<string[]>([]);
  const [isTestingTeams, setIsTestingTeams] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/admin/settings/integrations");
        if (response.ok) {
          const data: IntegrationSetting[] = await response.json();
          const getValue = (key: string) =>
            data.find((s) => s.key === key)?.value || "";

          setSlackEnabled(getValue("integrations.slack.enabled") === "true");
          setSlackWebhookUrl(getValue("integrations.slack.webhookUrl"));
          setSlackChannel(getValue("integrations.slack.channel"));
          const slackEvts = getValue("integrations.slack.events");
          setSlackEvents(slackEvts ? slackEvts.split(",") : []);

          setTeamsEnabled(getValue("integrations.teams.enabled") === "true");
          setTeamsWebhookUrl(getValue("integrations.teams.webhookUrl"));
          const teamsEvts = getValue("integrations.teams.events");
          setTeamsEvents(teamsEvts ? teamsEvts.split(",") : []);
        }
      } catch (err) {
        console.error("Failed to load integration settings", err);
        toast.error("Failed to load integration settings");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const toggleEvent = (
    events: string[],
    setEvents: React.Dispatch<React.SetStateAction<string[]>>,
    event: string,
  ) => {
    setEvents(
      events.includes(event)
        ? events.filter((e) => e !== event)
        : [...events, event],
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const settings = [
        { key: "integrations.slack.enabled", value: String(slackEnabled) },
        { key: "integrations.slack.webhookUrl", value: slackWebhookUrl },
        { key: "integrations.slack.channel", value: slackChannel },
        { key: "integrations.slack.events", value: slackEvents.join(",") },
        { key: "integrations.teams.enabled", value: String(teamsEnabled) },
        { key: "integrations.teams.webhookUrl", value: teamsWebhookUrl },
        { key: "integrations.teams.events", value: teamsEvents.join(",") },
      ];

      const response = await fetch("/api/admin/settings/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });

      if (response.ok) {
        toast.success("Integration settings saved successfully");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save integration settings");
      }
    } catch (err) {
      console.error("Failed to save integration settings", err);
      toast.error("Failed to save integration settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestSlack = async () => {
    if (!slackWebhookUrl) {
      toast.error("Please enter a Slack webhook URL");
      return;
    }
    setIsTestingSlack(true);
    try {
      const response = await fetch("/api/admin/settings/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "slack",
          webhookUrl: slackWebhookUrl,
          channel: slackChannel,
        }),
      });
      if (response.ok) {
        toast.success("Test notification sent to Slack");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to send test notification");
      }
    } catch (err) {
      console.error("Failed to send test notification", err);
      toast.error("Failed to send test notification");
    } finally {
      setIsTestingSlack(false);
    }
  };

  const handleTestTeams = async () => {
    if (!teamsWebhookUrl) {
      toast.error("Please enter a Teams webhook URL");
      return;
    }
    setIsTestingTeams(true);
    try {
      const response = await fetch("/api/admin/settings/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "teams",
          webhookUrl: teamsWebhookUrl,
        }),
      });
      if (response.ok) {
        toast.success("Test notification sent to Microsoft Teams");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to send test notification");
      }
    } catch (err) {
      console.error("Failed to send test notification", err);
      toast.error("Failed to send test notification");
    } finally {
      setIsTestingTeams(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Slack Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Slack Integration
              </CardTitle>
              <CardDescription>
                Send notifications to a Slack channel via incoming webhook
              </CardDescription>
            </div>
            <Badge variant={slackEnabled ? "default" : "outline"}>
              {slackEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="slack-enabled">Enable Slack Notifications</Label>
            </div>
            <Switch
              id="slack-enabled"
              checked={slackEnabled}
              onCheckedChange={setSlackEnabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slack-webhook">Webhook URL</Label>
            <Input
              id="slack-webhook"
              value={slackWebhookUrl}
              onChange={(e) => setSlackWebhookUrl(e.target.value)}
              placeholder={SLACK_WEBHOOK_PLACEHOLDER}
              type="url"
            />
            <p className="text-muted-foreground text-sm">
              Create an incoming webhook in your Slack workspace settings
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slack-channel">Channel Override (optional)</Label>
            <Input
              id="slack-channel"
              value={slackChannel}
              onChange={(e) => setSlackChannel(e.target.value)}
              placeholder="#asset-notifications"
            />
            <p className="text-muted-foreground text-sm">
              Override the default channel configured in the webhook
            </p>
          </div>

          <div className="space-y-3">
            <Label>Notification Events</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {NOTIFICATION_EVENTS.map((event) => (
                <div key={event.key} className="flex items-center gap-2">
                  <Checkbox
                    id={`slack-${event.key}`}
                    checked={slackEvents.includes(event.key)}
                    onCheckedChange={() =>
                      toggleEvent(slackEvents, setSlackEvents, event.key)
                    }
                  />
                  <Label
                    htmlFor={`slack-${event.key}`}
                    className="cursor-pointer text-sm font-normal"
                  >
                    {event.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleTestSlack}
            disabled={isTestingSlack || !slackWebhookUrl}
          >
            {isTestingSlack ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send Test Notification
          </Button>
        </CardContent>
      </Card>

      {/* Teams Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Microsoft Teams Integration
              </CardTitle>
              <CardDescription>
                Send notifications to a Teams channel via incoming webhook
              </CardDescription>
            </div>
            <Badge variant={teamsEnabled ? "default" : "outline"}>
              {teamsEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="teams-enabled">Enable Teams Notifications</Label>
            </div>
            <Switch
              id="teams-enabled"
              checked={teamsEnabled}
              onCheckedChange={setTeamsEnabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="teams-webhook">Webhook URL</Label>
            <Input
              id="teams-webhook"
              value={teamsWebhookUrl}
              onChange={(e) => setTeamsWebhookUrl(e.target.value)}
              placeholder={TEAMS_WEBHOOK_PLACEHOLDER}
              type="url"
            />
            <p className="text-muted-foreground text-sm">
              Create an incoming webhook connector in your Teams channel
            </p>
          </div>

          <div className="space-y-3">
            <Label>Notification Events</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {NOTIFICATION_EVENTS.map((event) => (
                <div key={event.key} className="flex items-center gap-2">
                  <Checkbox
                    id={`teams-${event.key}`}
                    checked={teamsEvents.includes(event.key)}
                    onCheckedChange={() =>
                      toggleEvent(teamsEvents, setTeamsEvents, event.key)
                    }
                  />
                  <Label
                    htmlFor={`teams-${event.key}`}
                    className="cursor-pointer text-sm font-normal"
                  >
                    {event.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleTestTeams}
            disabled={isTestingTeams || !teamsWebhookUrl}
          >
            {isTestingTeams ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send Test Notification
          </Button>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save All Integration Settings
        </Button>
      </div>
    </div>
  );
}
