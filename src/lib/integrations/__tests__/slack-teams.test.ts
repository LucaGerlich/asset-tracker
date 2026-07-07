import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    system_settings: {
      findMany: vi.fn(),
    },
  },
}));

// The SSRF guard does real DNS resolution; stub it valid so tests are
// deterministic and don't depend on the webhook hosts resolving.
vi.mock("@/lib/url-validation", () => ({
  validateOutboundUrl: vi.fn().mockResolvedValue({ valid: true }),
}));

const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
vi.stubGlobal("fetch", mockFetch);

import prisma from "@/lib/prisma";
import {
  getIntegrationSettings,
  formatSlackMessage,
  formatTeamsMessage,
  notifyIntegrations,
} from "../slack-teams";

function mockSettings(overrides: Array<{ key: string; value: string }>) {
  vi.mocked(prisma.system_settings.findMany).mockResolvedValue(
    overrides.map((o, i) => ({
      id: String(i + 1),
      settingKey: o.key,
      settingValue: o.value,
      settingType: "string",
      category: "integrations",
      isEncrypted: false,
      updatedAt: new Date(),
    })),
  );
}

describe("getIntegrationSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed Slack and Teams settings", async () => {
    mockSettings([
      { key: "integrations.slack.enabled", value: "true" },
      {
        key: "integrations.slack.webhookUrl",
        value: "https://hooks.slack.com/test",
      },
      { key: "integrations.slack.channel", value: "#alerts" },
      { key: "integrations.slack.events", value: "asset.created,user.created" },
      { key: "integrations.teams.enabled", value: "false" },
    ]);

    const settings = await getIntegrationSettings();

    expect(settings.slack.enabled).toBe(true);
    expect(settings.slack.webhookUrl).toBe("https://hooks.slack.com/test");
    expect(settings.slack.channel).toBe("#alerts");
    expect(settings.slack.events).toEqual(["asset.created", "user.created"]);
    expect(settings.teams.enabled).toBe(false);
  });

  it("returns disabled defaults when no settings exist", async () => {
    mockSettings([]);

    const settings = await getIntegrationSettings();

    expect(settings.slack.enabled).toBe(false);
    expect(settings.slack.webhookUrl).toBe("");
    expect(settings.slack.events).toEqual([]);
    expect(settings.teams.enabled).toBe(false);
  });
});

describe("formatSlackMessage", () => {
  it("formats asset.created event", () => {
    const result = formatSlackMessage("asset.created", {
      assetName: "MacBook Pro",
      assetTag: "ASSET-001",
    }) as { blocks: Array<{ text: { text: string } }> };

    expect(result.blocks).toBeDefined();
    expect(result.blocks[0].text.text).toContain("MacBook Pro");
    expect(result.blocks[0].text.text).toContain("ASSET-001");
  });

  it("formats user.created event", () => {
    const result = formatSlackMessage("user.created", {
      email: "john@example.com",
    }) as { blocks: Array<{ text: { text: string } }> };

    expect(result.blocks[0].text.text).toContain("john@example.com");
  });

  it("formats consumable.low_stock event", () => {
    const result = formatSlackMessage("consumable.low_stock", {
      consumableName: "Toner",
      quantity: 3,
      minQuantity: 10,
    }) as { blocks: Array<{ text: { text: string } }> };

    expect(result.blocks[0].text.text).toContain("Toner");
  });

  it("includes channel when provided", () => {
    const result = formatSlackMessage(
      "asset.created",
      { assetName: "Test" },
      "#alerts",
    );

    expect(result.channel).toBe("#alerts");
  });

  it("omits channel when not provided", () => {
    const result = formatSlackMessage("asset.created", { assetName: "Test" });

    expect(result.channel).toBeUndefined();
  });

  it("handles unknown event with generic message", () => {
    const result = formatSlackMessage("unknown.event", {
      foo: "bar",
    }) as { blocks: Array<{ text: { text: string } }> };

    expect(result.blocks[0].text.text).toContain("unknown.event");
  });
});

describe("formatTeamsMessage", () => {
  it("formats asset.created event", () => {
    const result = formatTeamsMessage("asset.created", {
      assetName: "MacBook Pro",
      assetTag: "ASSET-001",
    }) as {
      "@type": string;
      sections: Array<{ activityTitle: string; activitySubtitle: string }>;
    };

    expect(result["@type"]).toBe("MessageCard");
    expect(result.sections[0].activityTitle).toContain("Asset Created");
    expect(result.sections[0].activitySubtitle).toContain("MacBook Pro");
  });

  it("formats import.failed event", () => {
    const result = formatTeamsMessage("import.failed", {
      errorCount: 5,
      entityType: "assets",
    }) as { sections: Array<{ activitySubtitle: string }> };

    expect(result.sections[0].activitySubtitle).toContain("failed");
  });

  it("strips markdown bold from Teams messages", () => {
    const result = formatTeamsMessage("user.created", {
      email: "test@example.com",
    }) as { sections: Array<{ activitySubtitle: string }> };

    expect(result.sections[0].activitySubtitle).not.toContain("*");
    expect(result.sections[0].activitySubtitle).toContain("test@example.com");
  });
});

describe("notifyIntegrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
  });

  it("sends Slack notification for subscribed event", async () => {
    mockSettings([
      { key: "integrations.slack.enabled", value: "true" },
      {
        key: "integrations.slack.webhookUrl",
        value: "https://hooks.slack.com/test",
      },
      { key: "integrations.slack.events", value: "asset.created" },
    ]);

    await notifyIntegrations("asset.created", { assetName: "Test" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://hooks.slack.com/test",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("does not send when event is not subscribed", async () => {
    mockSettings([
      { key: "integrations.slack.enabled", value: "true" },
      {
        key: "integrations.slack.webhookUrl",
        value: "https://hooks.slack.com/test",
      },
      { key: "integrations.slack.events", value: "user.created" },
    ]);

    await notifyIntegrations("asset.created", { assetName: "Test" });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not send when integration is disabled", async () => {
    mockSettings([
      { key: "integrations.slack.enabled", value: "false" },
      {
        key: "integrations.slack.webhookUrl",
        value: "https://hooks.slack.com/test",
      },
      { key: "integrations.slack.events", value: "asset.created" },
    ]);

    await notifyIntegrations("asset.created", { assetName: "Test" });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sends to both Slack and Teams when both enabled", async () => {
    mockSettings([
      { key: "integrations.slack.enabled", value: "true" },
      {
        key: "integrations.slack.webhookUrl",
        value: "https://hooks.slack.com/test",
      },
      { key: "integrations.slack.events", value: "asset.created" },
      { key: "integrations.teams.enabled", value: "true" },
      {
        key: "integrations.teams.webhookUrl",
        value: "https://teams.webhook.com/test",
      },
      { key: "integrations.teams.events", value: "asset.created" },
    ]);

    await notifyIntegrations("asset.created", { assetName: "Test" });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does not throw on fetch failure", async () => {
    mockSettings([
      { key: "integrations.slack.enabled", value: "true" },
      {
        key: "integrations.slack.webhookUrl",
        value: "https://hooks.slack.com/test",
      },
      { key: "integrations.slack.events", value: "asset.created" },
    ]);
    mockFetch.mockRejectedValue(new Error("Network error"));

    await notifyIntegrations("asset.created", { assetName: "Test" });
  });

  it("does not send when no settings exist", async () => {
    mockSettings([]);

    await notifyIntegrations("asset.created", { assetName: "Test" });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
