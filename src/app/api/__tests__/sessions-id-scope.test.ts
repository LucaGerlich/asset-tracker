import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { DELETE: "DELETE" },
  AUDIT_ENTITIES: { USER: "USER" },
}));
vi.mock("@/lib/session-tracking", () => ({
  revokeSession: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/organization-context", () => ({
  scopeToOrganization: vi.fn(
    (where: Record<string, unknown>, organizationId?: string | null) => ({
      ...where,
      organizationId: organizationId ?? null,
    }),
  ),
}));

import { DELETE } from "@/app/api/auth/sessions/[id]/route";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";

const mockPrisma = vi.mocked(prisma, true);

const admin = {
  id: "admin-uuid-001",
  isAdmin: true,
  organizationId: "org-1",
};

const del = (id: string) =>
  DELETE(createMockRequest(`/api/auth/sessions/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireApiAuth).mockResolvedValue(admin as never);
});

describe("DELETE /api/auth/sessions/[id] as admin", () => {
  it("looks the session up inside the admin's organization only", async () => {
    mockPrisma.sessions.findFirst.mockResolvedValue({
      userId: "u-1",
      deviceName: null,
      ipAddress: null,
    } as never);

    const res = await del("sess-1");

    expect(res.status).toBe(200);
    expect(mockPrisma.sessions.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sess-1", user: { organizationId: "org-1" } },
      }),
    );
    expect(mockPrisma.sessions.delete).toHaveBeenCalledWith({
      where: { id: "sess-1" },
    });
  });

  it("answers 404 and deletes nothing for a session of another organization", async () => {
    mockPrisma.sessions.findFirst.mockResolvedValue(null);

    const res = await del("sess-foreign");

    expect(res.status).toBe(404);
    expect(mockPrisma.sessions.delete).not.toHaveBeenCalled();
  });
});
