import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { UPDATE: "UPDATE" },
  AUDIT_ENTITIES: { COMPONENT: "COMPONENT" },
}));
vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/integrations/slack-teams", () => ({
  notifyIntegrations: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn().mockResolvedValue({
    organization: { id: "org-uuid-001" },
  }),
  scopeToOrganization: (where: object, organizationId?: string | null) => ({
    ...where,
    organizationId: organizationId ?? null,
  }),
}));

import { PUT } from "@/app/api/components/route";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, true);

const existing = {
  id: "comp-1",
  name: "RAM",
  totalQuantity: 10,
  remainingQuantity: 7,
  organizationId: "org-uuid-001",
};

const put = (body: Record<string, unknown>) =>
  PUT(createMockRequest("/api/components", { method: "PUT", body }));

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.component.findFirst.mockResolvedValue(existing as never);
  mockPrisma.component.update.mockResolvedValue(existing as never);
});

describe("PUT /api/components remainingQuantity", () => {
  it("does not touch stock when only the name changes", async () => {
    const res = await put({ id: "comp-1", name: "RAM DDR5" });
    expect(res.status).toBe(200);
    expect(mockPrisma.component.update).toHaveBeenCalledWith({
      where: { id: "comp-1" },
      data: { name: "RAM DDR5" },
    });
  });

  it.each([-1, 1.5, "5"])(
    "rejects a non-integer/negative value %s",
    async (v) => {
      const res = await put({ id: "comp-1", remainingQuantity: v });
      expect(res.status).toBe(400);
      expect(mockPrisma.component.update).not.toHaveBeenCalled();
    },
  );

  it("rejects remainingQuantity above the existing total", async () => {
    const res = await put({ id: "comp-1", remainingQuantity: 11 });
    const { body } = await parseResponse<{ error: string }>(res);
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/remainingQuantity/);
    expect(mockPrisma.component.update).not.toHaveBeenCalled();
  });

  it("validates remainingQuantity against the new total when both change", async () => {
    const bad = await put({
      id: "comp-1",
      totalQuantity: 4,
      remainingQuantity: 5,
    });
    expect(bad.status).toBe(400);

    const ok = await put({
      id: "comp-1",
      totalQuantity: 20,
      remainingQuantity: 15,
    });
    expect(ok.status).toBe(200);
    expect(mockPrisma.component.update).toHaveBeenCalledWith({
      where: { id: "comp-1" },
      data: { totalQuantity: 20, remainingQuantity: 15 },
    });
  });

  it("still reconciles remaining when only the total changes", async () => {
    await put({ id: "comp-1", totalQuantity: 20 });
    expect(mockPrisma.component.update).toHaveBeenCalledWith({
      where: { id: "comp-1" },
      data: { totalQuantity: 20, remainingQuantity: 17 },
    });
  });
});
