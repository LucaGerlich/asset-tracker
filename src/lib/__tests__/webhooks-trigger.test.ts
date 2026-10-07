import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");

import prisma from "@/lib/prisma";
import { triggerWebhook } from "@/lib/webhooks";

const mockPrisma = vi.mocked(prisma, true);

const ORG_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.webhook.findMany.mockResolvedValue([]);
});

describe("triggerWebhook organization filter", () => {
  it("reaches only global webhooks when no organization is given", async () => {
    await triggerWebhook("asset.updated", { assetId: "a1" });

    expect(mockPrisma.webhook.findMany).toHaveBeenCalledTimes(1);
    const where = mockPrisma.webhook.findMany.mock.calls[0][0]?.where;
    expect(where).toEqual({
      isActive: true,
      events: { has: "asset.updated" },
      organizationId: null,
    });
    expect(where).not.toHaveProperty("OR");
  });

  it("treats a null organization like a missing one", async () => {
    await triggerWebhook("asset.updated", {}, null);

    const where = mockPrisma.webhook.findMany.mock.calls[0][0]?.where;
    expect(where?.organizationId).toBeNull();
    expect(where).not.toHaveProperty("OR");
  });

  it("reaches the organization's webhooks and the global ones when an organization is given", async () => {
    await triggerWebhook("asset.updated", {}, ORG_ID);

    const where = mockPrisma.webhook.findMany.mock.calls[0][0]?.where;
    expect(where).toEqual({
      isActive: true,
      events: { has: "asset.updated" },
      OR: [{ organizationId: ORG_ID }, { organizationId: null }],
    });
    expect(where).not.toHaveProperty("organizationId");
  });
});
