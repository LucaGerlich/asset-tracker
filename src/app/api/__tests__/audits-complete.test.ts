import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");

vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn(),
  scopeToOrganization: vi.fn(
    (where: Record<string, unknown>, organizationId?: string | null) => ({
      ...where,
      organizationId: organizationId || null,
    }),
  ),
}));

vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { UPDATE: "update" },
  AUDIT_ENTITIES: { AUDIT_CAMPAIGN: "audit_campaign" },
}));

vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/integrations/slack-teams", () => ({
  notifyIntegrations: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/audits/[id]/complete/route";
import prisma from "@/lib/prisma";
import { getOrganizationContext } from "@/lib/organization-context";
import { createAuditLog } from "@/lib/audit-log";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";

const mockPrisma = vi.mocked(prisma, true);
const mockOrgContext = vi.mocked(getOrganizationContext);

const CAMPAIGN_ID = "campaign-uuid-001";
const CALLER_ORG = "org-uuid-001";

const activeCampaign = {
  id: CAMPAIGN_ID,
  name: "Q1 2026 Audit",
  status: "active",
  organizationId: CALLER_ORG,
  entries: [
    { status: "found" },
    { status: "found" },
    { status: "missing" },
    { status: "unscanned" },
  ],
};

const complete = () =>
  POST(
    createMockRequest(`/api/audits/${CAMPAIGN_ID}/complete`, {
      method: "POST",
    }),
    { params: Promise.resolve({ id: CAMPAIGN_ID }) },
  );

function asOrgContext(organizationId: string | null) {
  mockOrgContext.mockResolvedValue(
    organizationId
      ? ({ organization: { id: organizationId } } as Awaited<
          ReturnType<typeof getOrganizationContext>
        >)
      : null,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  asOrgContext(CALLER_ORG);
  mockPrisma.auditCampaign.update.mockResolvedValue({
    id: CAMPAIGN_ID,
    status: "completed",
  } as Awaited<ReturnType<typeof prisma.auditCampaign.update>>);
});

describe("POST /api/audits/[id]/complete organization scope", () => {
  it("looks the campaign up scoped to the caller's organization", async () => {
    mockPrisma.auditCampaign.findFirst.mockResolvedValue(
      activeCampaign as never,
    );

    await complete();

    expect(mockPrisma.auditCampaign.findFirst).toHaveBeenCalledWith({
      where: { id: CAMPAIGN_ID, organizationId: CALLER_ORG },
      include: { entries: true },
    });
    expect(mockPrisma.auditCampaign.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 for a campaign of another organization and changes nothing", async () => {
    // The scoped lookup finds nothing for another organization's campaign.
    mockPrisma.auditCampaign.findFirst.mockResolvedValue(null);

    const { status, body } = await parseResponse<{ error: string }>(
      await complete(),
    );

    expect(status).toBe(404);
    expect(body.error).toBe("Audit campaign not found");
    expect(mockPrisma.auditCampaign.update).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
    expect(triggerWebhook).not.toHaveBeenCalled();
    expect(notifyIntegrations).not.toHaveBeenCalled();
  });

  it("scopes an org-less caller to org-less campaigns only", async () => {
    asOrgContext(null);
    mockPrisma.auditCampaign.findFirst.mockResolvedValue(null);

    const { status } = await parseResponse(await complete());

    expect(status).toBe(404);
    expect(mockPrisma.auditCampaign.findFirst).toHaveBeenCalledWith({
      where: { id: CAMPAIGN_ID, organizationId: null },
      include: { entries: true },
    });
    expect(mockPrisma.auditCampaign.update).not.toHaveBeenCalled();
    expect(triggerWebhook).not.toHaveBeenCalled();
  });

  it("completes an own-organization campaign and forwards the record's organization to the webhook", async () => {
    mockPrisma.auditCampaign.findFirst.mockResolvedValue(
      activeCampaign as never,
    );

    const { status, body } = await parseResponse<{
      status: string;
      summary: { total: number; found: number; missing: number };
    }>(await complete());

    expect(status).toBe(200);
    expect(body.summary).toMatchObject({ total: 4, found: 2, missing: 1 });
    expect(mockPrisma.auditCampaign.update).toHaveBeenCalledWith({
      where: { id: CAMPAIGN_ID },
      data: { status: "completed", completedAt: expect.any(Date) },
    });
    expect(triggerWebhook).toHaveBeenCalledWith(
      "audit.campaign_completed",
      {
        campaignId: CAMPAIGN_ID,
        campaignName: "Q1 2026 Audit",
        total: 4,
        found: 2,
        missing: 1,
      },
      activeCampaign.organizationId,
    );
  });

  it("rejects a campaign that is not active without writing", async () => {
    mockPrisma.auditCampaign.findFirst.mockResolvedValue({
      ...activeCampaign,
      status: "completed",
    } as never);

    const { status } = await parseResponse(await complete());

    expect(status).toBe(400);
    expect(mockPrisma.auditCampaign.update).not.toHaveBeenCalled();
    expect(triggerWebhook).not.toHaveBeenCalled();
  });
});
