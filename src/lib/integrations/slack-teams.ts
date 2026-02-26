import prisma from "@/lib/prisma";

interface IntegrationConfig {
  enabled: boolean;
  webhookUrl: string;
  channel: string;
  events: string[];
}

export interface IntegrationSettings {
  slack: IntegrationConfig;
  teams: IntegrationConfig;
}

/**
 * Read integration settings from system_settings table.
 */
export async function getIntegrationSettings(): Promise<IntegrationSettings> {
  const rows = await prisma.system_settings.findMany({
    where: { settingKey: { startsWith: "integrations." } },
  });

  const getValue = (key: string): string =>
    rows.find((r) => r.settingKey === key)?.settingValue || "";

  return {
    slack: {
      enabled: getValue("integrations.slack.enabled") === "true",
      webhookUrl: getValue("integrations.slack.webhookUrl"),
      channel: getValue("integrations.slack.channel"),
      events: getValue("integrations.slack.events")
        ? getValue("integrations.slack.events").split(",")
        : [],
    },
    teams: {
      enabled: getValue("integrations.teams.enabled") === "true",
      webhookUrl: getValue("integrations.teams.webhookUrl"),
      channel: "",
      events: getValue("integrations.teams.events")
        ? getValue("integrations.teams.events").split(",")
        : [],
    },
  };
}

/**
 * Event-to-message mapping.
 * Returns a human-readable title and description for each event.
 */
function getEventMessage(
  event: string,
  data: Record<string, unknown>,
): { title: string; description: string } {
  switch (event) {
    case "asset.created":
      return {
        title: "Asset Created",
        description: `Asset *${data.assetName || "Unknown"}* (${data.assetTag || "no tag"}) was created`,
      };
    case "asset.updated":
      return {
        title: "Asset Updated",
        description: `Asset *${data.assetName || "Unknown"}* (${data.assetTag || "no tag"}) was updated`,
      };
    case "asset.deleted":
      return {
        title: "Asset Deleted",
        description: `Asset *${data.assetName || "Unknown"}* was deleted`,
      };
    case "asset.assigned":
      return {
        title: "Asset Assigned",
        description: `Asset *${data.assetName || "Unknown"}* was assigned`,
      };
    case "consumable.low_stock":
      return {
        title: "Low Stock Alert",
        description: `Low stock: *${data.consumableName || "Unknown"}* — ${data.quantity ?? "?"}/${data.minQuantity ?? "?"} remaining`,
      };
    case "consumable.critical_stock":
      return {
        title: "Critical Stock Alert",
        description: `Critical stock: *${data.consumableName || "Unknown"}* — ${data.quantity ?? "?"}/${data.minQuantity ?? "?"} remaining`,
      };
    case "maintenance.due":
      return {
        title: "Maintenance Due",
        description: `Maintenance due: *${data.maintenanceTitle || data.title || "Unknown"}* for ${data.assetName || "asset"}`,
      };
    case "license.expiring":
      return {
        title: "License Expiring",
        description: `License expiring: *${data.licenseName || "Unknown"}* on ${data.expirationDate || "unknown date"}`,
      };
    case "user.created":
      return {
        title: "User Created",
        description: `New user created: *${data.email || "Unknown"}*`,
      };
    case "import.completed":
      return {
        title: "Import Completed",
        description: `Import completed: ${data.successCount ?? data.totalRows ?? "?"} records imported`,
      };
    case "import.failed":
      return {
        title: "Import Failed",
        description: `Import failed: ${data.errorCount ?? "?"} errors in ${data.entityType || "import"}`,
      };
    case "component.created":
      return {
        title: "Component Created",
        description: `Component *${data.componentName || "Unknown"}* was created`,
      };
    case "component.checked_out":
      return {
        title: "Component Checked Out",
        description: `Component *${data.componentName || "Unknown"}* — ${data.quantity ?? 1} unit(s) checked out to asset *${data.assetName || "Unknown"}*`,
      };
    case "component.low_stock":
      return {
        title: "Component Low Stock",
        description: `Low stock: *${data.componentName || "Unknown"}* — ${data.remaining ?? "?"}/${data.minQuantity ?? "?"} remaining`,
      };
    case "license.seat_assigned":
      return {
        title: "License Seat Assigned",
        description: `License seat assigned to *${data.userName || "Unknown"}* for *${data.licenceName || "Unknown"}*`,
      };
    case "license.seat_unassigned":
      return {
        title: "License Seat Unassigned",
        description: `License seat unassigned from *${data.userName || "Unknown"}* for *${data.licenceName || "Unknown"}*`,
      };
    case "kit.checked_out":
      return {
        title: "Kit Checked Out",
        description: `Kit *${data.kitName || "Unknown"}* checked out to *${data.userName || "Unknown"}*`,
      };
    case "audit.campaign_created":
      return {
        title: "Audit Campaign Created",
        description: `Audit campaign *${data.campaignName || "Unknown"}* was created`,
      };
    case "audit.campaign_completed":
      return {
        title: "Audit Campaign Completed",
        description: `Audit campaign *${data.campaignName || "Unknown"}* completed — ${data.found ?? "?"}/${data.total ?? "?"} assets found`,
      };
    case "asset.bulk_checked_out":
      return {
        title: "Bulk Asset Checkout",
        description: `${data.count ?? "?"} assets bulk-checked out to *${data.targetLabel || "Unknown"}*`,
      };
    case "eula.accepted":
      return {
        title: "EULA Accepted",
        description: `*${data.userName || "Unknown"}* accepted EULA *${data.eulaName || "Unknown"}* for asset checkout`,
      };
    case "ldap.sync_completed":
      return {
        title: "LDAP Sync Completed",
        description: `LDAP sync: ${data.created ?? 0} created, ${data.updated ?? 0} updated, ${data.deactivated ?? 0} deactivated`,
      };
    case "user.sso_login":
      return {
        title: "SSO Login",
        description: `*${data.userName || "Unknown"}* logged in via ${data.method || "SSO"}`,
      };
    default:
      return {
        title: "Notification",
        description: `Event: ${event}`,
      };
  }
}

/**
 * Format a Slack webhook message with blocks.
 */
export function formatSlackMessage(
  event: string,
  data: Record<string, unknown>,
  channel?: string,
): Record<string, unknown> {
  const { title, description } = getEventMessage(event, data);

  return {
    ...(channel ? { channel } : {}),
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Asset Tracker — ${title}*\n${description}`,
        },
      },
    ],
  };
}

/**
 * Format a Microsoft Teams MessageCard.
 */
export function formatTeamsMessage(
  event: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const { title, description } = getEventMessage(event, data);
  const plainDescription = description.replace(/\*/g, "");

  return {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: "0076D7",
    summary: `Asset Tracker — ${title}`,
    sections: [
      {
        activityTitle: `Asset Tracker — ${title}`,
        activitySubtitle: plainDescription,
        markdown: true,
      },
    ],
  };
}

/**
 * Send Slack/Teams notifications for an event.
 * Fire-and-forget: errors are logged, never thrown.
 */
export async function notifyIntegrations(
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const settings = await getIntegrationSettings();

    const promises: Promise<void>[] = [];

    if (
      settings.slack.enabled &&
      settings.slack.webhookUrl &&
      settings.slack.events.includes(event)
    ) {
      const payload = formatSlackMessage(
        event,
        data,
        settings.slack.channel || undefined,
      );
      promises.push(
        fetch(settings.slack.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then(() => undefined),
      );
    }

    if (
      settings.teams.enabled &&
      settings.teams.webhookUrl &&
      settings.teams.events.includes(event)
    ) {
      const payload = formatTeamsMessage(event, data);
      promises.push(
        fetch(settings.teams.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then(() => undefined),
      );
    }

    await Promise.allSettled(promises);
  } catch (error) {
    console.error("Integration notification error:", error);
  }
}
