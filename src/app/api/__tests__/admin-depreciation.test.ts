import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn(),
  AUDIT_ACTIONS: { UPDATE: "UPDATE" },
  AUDIT_ENTITIES: { DEPRECIATION_SETTINGS: "depreciation_settings" },
}));
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn(),
}));

import { PUT } from "@/app/api/admin/depreciation/[id]/route";
import prisma from "@/lib/prisma";
import { requireApiAdmin, requireNotDemoMode } from "@/lib/api-auth";
import { ForbiddenError } from "@/lib/errors";
import { getOrganizationContext } from "@/lib/organization-context";
import { createAuditLog } from "@/lib/audit-log";

const mockPrisma = vi.mocked(prisma, true);

const OWN_ORG = "org-uuid-001";
const SETTING_ID = "11111111-1111-4111-8111-111111111111";
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";

const validBody = {
  method: "declining_balance",
  usefulLifeYears: 4,
  salvagePercent: 15,
};

function call(id: string, body: Record<string, unknown> = validBody) {
  return PUT(
    createMockRequest(`/api/admin/depreciation/${id}`, {
      method: "PUT",
      body,
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe("PUT /api/admin/depreciation/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrganizationContext).mockResolvedValue({
      organization: { id: OWN_ORG },
    } as Awaited<ReturnType<typeof getOrganizationContext>>);
    mockPrisma.depreciation_settings.findFirst.mockResolvedValue({
      id: SETTING_ID,
      categoryId: CATEGORY_ID,
    } as never);
    mockPrisma.depreciation_settings.update.mockResolvedValue({
      id: SETTING_ID,
      ...validBody,
    } as never);
  });

  it("updates settings scoped through the category organization", async () => {
    const { status, body } = await parseResponse<{ method: string }>(
      await call(SETTING_ID),
    );
    expect(status).toBe(200);
    expect(body.method).toBe("declining_balance");
    expect(mockPrisma.depreciation_settings.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: SETTING_ID,
          assetCategoryType: { organizationId: OWN_ORG },
        },
      }),
    );
    expect(mockPrisma.depreciation_settings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SETTING_ID },
        data: expect.objectContaining(validBody),
      }),
    );
    expect(createAuditLog).toHaveBeenCalled();
  });

  it("returns 404 for settings of another organization", async () => {
    mockPrisma.depreciation_settings.findFirst.mockResolvedValue(null);
    const { status } = await parseResponse(await call(SETTING_ID));
    expect(status).toBe(404);
    expect(mockPrisma.depreciation_settings.update).not.toHaveBeenCalled();
  });

  it("falls back to org-less scope when the user has no organization", async () => {
    vi.mocked(getOrganizationContext).mockResolvedValue(null);
    await call(SETTING_ID);
    expect(mockPrisma.depreciation_settings.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: SETTING_ID,
          assetCategoryType: { organizationId: null },
        },
      }),
    );
  });

  it("rejects an invalid method", async () => {
    const { status } = await parseResponse(
      await call(SETTING_ID, { ...validBody, method: "bogus" }),
    );
    expect(status).toBe(400);
    expect(mockPrisma.depreciation_settings.update).not.toHaveBeenCalled();
  });

  it("rejects out-of-range numbers", async () => {
    expect(
      (await call(SETTING_ID, { ...validBody, salvagePercent: 101 })).status,
    ).toBe(400);
    expect(
      (await call(SETTING_ID, { ...validBody, usefulLifeYears: 0 })).status,
    ).toBe(400);
  });

  it("rejects a malformed id", async () => {
    const { status } = await parseResponse(await call("not-a-uuid"));
    expect(status).toBe(400);
  });

  it("returns 403 for non-admins", async () => {
    vi.mocked(requireApiAdmin).mockRejectedValueOnce(
      new ForbiddenError("not_admin", "Admin access required"),
    );
    const { status } = await parseResponse(await call(SETTING_ID));
    expect(status).toBe(403);
    expect(mockPrisma.depreciation_settings.update).not.toHaveBeenCalled();
  });

  it("is blocked in demo mode", async () => {
    vi.mocked(requireNotDemoMode).mockReturnValueOnce(
      new Response(null, { status: 403 }) as never,
    );
    const res = await call(SETTING_ID);
    expect(res.status).toBe(403);
    expect(mockPrisma.depreciation_settings.update).not.toHaveBeenCalled();
  });
});
