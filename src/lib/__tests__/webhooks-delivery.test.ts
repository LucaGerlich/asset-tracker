import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/url-validation", () => ({
  validateOutboundUrl: vi.fn().mockResolvedValue({ valid: true }),
}));

import prisma from "@/lib/prisma";
import { triggerWebhook } from "@/lib/webhooks";

const mockPrisma = vi.mocked(prisma, true);
const fetchMock = vi.fn();

const webhook = {
  id: "wh-1",
  url: "https://hooks.example.com/in",
  secret: null,
  retryAttempts: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  mockPrisma.webhook.findMany.mockResolvedValue([webhook] as never);
  mockPrisma.webhookDelivery.create.mockResolvedValue({} as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("webhook delivery redirects", () => {
  it("does not follow redirects", async () => {
    fetchMock.mockResolvedValue(new Response("ok", { status: 200 }));

    await triggerWebhook("asset.updated", {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("records a 3xx response as a failed delivery without storing its body", async () => {
    fetchMock.mockResolvedValue(
      new Response("internal secret", {
        status: 302,
        headers: { Location: "http://169.254.169.254/latest/meta-data" },
      }),
    );

    await triggerWebhook("asset.updated", {});

    expect(mockPrisma.webhookDelivery.create).toHaveBeenCalledTimes(1);
    const data = mockPrisma.webhookDelivery.create.mock.calls[0][0].data;
    expect(data.success).toBe(false);
    expect(data.statusCode).toBe(302);
    expect(String(data.response ?? "")).not.toContain("internal secret");
  });
});
