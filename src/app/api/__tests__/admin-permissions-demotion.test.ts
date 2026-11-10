import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { UPDATE: "UPDATE" },
  AUDIT_ENTITIES: { USER: "user" },
}));
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi
    .fn()
    .mockResolvedValue({ organization: { id: "org-1" } }),
  scopeToOrganization: vi.fn(
    (where: Record<string, unknown>, organizationId?: string | null) => ({
      ...where,
      organizationId: organizationId ?? null,
    }),
  ),
}));

import { PATCH as bulkPatch } from "@/app/api/admin/users/bulk-permissions/route";
import { PATCH as singlePatch } from "@/app/api/admin/users/[id]/permissions/route";
import prisma from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/api-auth";
import { createAuditLog } from "@/lib/audit-log";

const mockPrisma = vi.mocked(prisma, true);

const ADMIN_ID = "admin-uuid-001";

const bulk = (body: Record<string, unknown>) =>
  bulkPatch(
    createMockRequest("/api/admin/users/bulk-permissions", {
      method: "PATCH",
      body,
    }),
  );

const single = (id: string, body: Record<string, unknown>) =>
  singlePatch(
    createMockRequest(`/api/admin/users/${id}/permissions`, {
      method: "PATCH",
      body,
    }),
    { params: Promise.resolve({ id }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireApiAdmin).mockResolvedValue({
    id: ADMIN_ID,
    isAdmin: true,
    organizationId: "org-1",
  } as never);
  // Another active admin remains unless a test says otherwise.
  mockPrisma.user.count.mockResolvedValue(1);
  mockPrisma.user.updateMany.mockResolvedValue({ count: 2 });
  mockPrisma.user.findFirst.mockResolvedValue({ userid: "u-2" } as never);
  mockPrisma.user.update.mockResolvedValue({ userid: "u-2" } as never);
});

describe("PATCH /api/admin/users/bulk-permissions", () => {
  it("refuses to remove admin from the caller", async () => {
    const res = await bulk({ userIds: [ADMIN_ID, "u-2"], isadmin: false });

    expect(res.status).toBe(400);
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to remove the last active admin of the organization", async () => {
    mockPrisma.user.count.mockResolvedValue(0);

    const res = await bulk({ userIds: ["u-2", "u-3"], isadmin: false });

    expect(res.status).toBe(400);
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("demotes others when an active admin remains, and audits the change", async () => {
    const res = await bulk({ userIds: ["u-2", "u-3"], isadmin: false });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.count).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        isadmin: true,
        isActive: true,
        userid: { notIn: ["u-2", "u-3"] },
      },
    });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ADMIN_ID,
        action: "UPDATE",
        details: expect.objectContaining({
          type: "bulk_permission_update",
          userIds: ["u-2", "u-3"],
          changes: { isadmin: false },
        }),
      }),
    );
  });

  it("accepts the updates object the settings UI sends", async () => {
    const res = await bulk({
      userIds: ["u-2"],
      updates: { canrequest: false },
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.count).not.toHaveBeenCalled();
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ canrequest: false }),
      }),
    );
  });

  it("does not guard promotions or request-permission changes", async () => {
    mockPrisma.user.count.mockResolvedValue(0);

    const res = await bulk({ userIds: [ADMIN_ID], isadmin: true });

    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/admin/users/[id]/permissions", () => {
  it("refuses to remove admin from the caller", async () => {
    const res = await single(ADMIN_ID, { isadmin: false });

    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("refuses to remove the last active admin of the organization", async () => {
    mockPrisma.user.count.mockResolvedValue(0);

    const res = await single("u-2", { isadmin: false });

    expect(res.status).toBe(400);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("demotes another admin when an active admin remains", async () => {
    const res = await single("u-2", { isadmin: false });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
  });
});
