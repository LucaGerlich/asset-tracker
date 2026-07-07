import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

// Mock all dependencies BEFORE importing the route
vi.mock("@/lib/prisma");

vi.mock("@/lib/api-auth");

vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn().mockResolvedValue({
    organization: { id: "org-uuid-001" },
  }),
  scopeToOrganization: vi.fn((where: any) => ({
    ...where,
    organizationId: "org-uuid-001",
  })),
}));

vi.mock("@/lib/validations", () => ({
  validateBody: vi.fn((_schema: any, body: any) => body),
  createAuditCampaignSchema: {},
  updateAuditCampaignSchema: {},
}));

vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { CREATE: "create", UPDATE: "update", DELETE: "delete" },
  AUDIT_ENTITIES: { AUDIT_CAMPAIGN: "audit_campaign" },
}));

vi.mock("@/lib/logger");

vi.mock("@/lib/pagination", () => ({
  parsePaginationParams: vi
    .fn()
    .mockReturnValue({ page: 1, pageSize: 25, search: null }),
  buildPrismaArgs: vi.fn().mockReturnValue({ skip: 0, take: 25 }),
  buildPaginatedResponse: vi.fn((items: any, total: number) => ({
    data: items,
    total,
  })),
}));

vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/integrations/slack-teams", () => ({
  notifyIntegrations: vi.fn().mockResolvedValue(undefined),
}));

import { GET, POST, DELETE } from "@/app/api/audits/route";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/api-auth";
import { triggerWebhook } from "@/lib/webhooks";
import { notifyIntegrations } from "@/lib/integrations/slack-teams";

const mockPrisma = vi.mocked(prisma);
const mockRequirePermission = vi.mocked(requirePermission);

const mockCampaign = {
  id: "campaign-uuid-001",
  name: "Q1 2026 Audit",
  description: "Quarterly audit",
  status: "draft",
  dueDate: null,
  scopeType: "all",
  scopeId: null,
  createdBy: "admin-uuid-001",
  organizationId: "org-uuid-001",
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({
    id: "admin-uuid-001",
    isAdmin: true,
    organizationId: "org-uuid-001",
  } as any);
});

// ---------------------------------------------------------------------------
// GET /api/audits
// ---------------------------------------------------------------------------
describe("GET /api/audits", () => {
  it("returns all campaigns when no page param", async () => {
    mockPrisma.auditCampaign.findMany.mockResolvedValue([mockCampaign] as any);

    const req = createMockRequest("/api/audits");
    const res = await GET(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Q1 2026 Audit");
  });
});

// ---------------------------------------------------------------------------
// POST /api/audits
// ---------------------------------------------------------------------------
describe("POST /api/audits", () => {
  it("creates a campaign with auditors and returns 201", async () => {
    vi.mocked(mockPrisma.$transaction).mockImplementation(async (cb: any) =>
      cb(mockPrisma),
    );
    mockPrisma.auditCampaign.create.mockResolvedValue(mockCampaign as any);

    const req = createMockRequest("/api/audits", {
      method: "POST",
      body: {
        name: "Q1 2026 Audit",
        description: "Quarterly audit",
        scopeType: "all",
        auditorIds: [
          "550e8400-e29b-41d4-a716-446655440001",
          "550e8400-e29b-41d4-a716-446655440002",
        ],
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(201);
    expect(body.name).toBe("Q1 2026 Audit");
    expect(mockPrisma.auditCampaign.create).toHaveBeenCalled();
    expect(mockPrisma.auditCampaignAuditor.createMany).toHaveBeenCalledWith({
      data: [
        {
          campaignId: "campaign-uuid-001",
          userId: "550e8400-e29b-41d4-a716-446655440001",
        },
        {
          campaignId: "campaign-uuid-001",
          userId: "550e8400-e29b-41d4-a716-446655440002",
        },
      ],
    });
  });

  it("triggers webhook and integration notification", async () => {
    vi.mocked(mockPrisma.$transaction).mockImplementation(async (cb: any) =>
      cb(mockPrisma),
    );
    mockPrisma.auditCampaign.create.mockResolvedValue(mockCampaign as any);

    const req = createMockRequest("/api/audits", {
      method: "POST",
      body: {
        name: "Q1 2026 Audit",
        scopeType: "all",
      },
    });
    await POST(req);

    expect(triggerWebhook).toHaveBeenCalledWith("audit.campaign_created", {
      campaignId: "campaign-uuid-001",
      campaignName: "Q1 2026 Audit",
    });
    expect(notifyIntegrations).toHaveBeenCalledWith("audit.campaign_created", {
      campaignName: "Q1 2026 Audit",
    });
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/audits
// ---------------------------------------------------------------------------
describe("DELETE /api/audits", () => {
  it("deletes a campaign and returns 200", async () => {
    mockPrisma.auditCampaign.findFirst.mockResolvedValue({
      name: "Q1 2026 Audit",
    } as any);
    mockPrisma.auditCampaign.delete.mockResolvedValue(mockCampaign as any);

    const req = createMockRequest("/api/audits", {
      method: "DELETE",
      body: { id: "campaign-uuid-001" },
    });
    const res = await DELETE(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(200);
    expect(body.message).toBe("Audit campaign deleted successfully");
    expect(mockPrisma.auditCampaign.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "campaign-uuid-001" } }),
    );
  });

  it("returns 404 when campaign not found", async () => {
    mockPrisma.auditCampaign.findFirst.mockResolvedValue(null);

    const req = createMockRequest("/api/audits", {
      method: "DELETE",
      body: { id: "nonexistent" },
    });
    const res = await DELETE(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(404);
    expect(body.error).toBe("Audit campaign not found");
  });

  it("returns 400 when id is missing", async () => {
    const req = createMockRequest("/api/audits", {
      method: "DELETE",
      body: {},
    });
    const res = await DELETE(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(400);
    expect(body.error).toBe("Campaign ID is required");
  });
});
