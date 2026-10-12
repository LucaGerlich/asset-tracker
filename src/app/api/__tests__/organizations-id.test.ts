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
  AUDIT_ACTIONS: { UPDATE: "UPDATE", DELETE: "DELETE" },
}));

import { DELETE, GET, PUT } from "@/app/api/organizations/[id]/route";
import prisma from "@/lib/prisma";
import {
  requireApiAdmin,
  requireSuperAdmin,
  requireWritableOrg,
} from "@/lib/api-auth";
import { createAuditLog } from "@/lib/audit-log";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { updateOrganizationSchema } from "@/lib/validation-organization";

const mockPrisma = vi.mocked(prisma, true);
const params = { params: Promise.resolve({ id: "org-uuid-001" }) };

const orgAdmin = {
  id: "admin-uuid-001",
  isAdmin: true,
  organizationId: "org-uuid-001",
  orgStatus: "active" as const,
};

const superAdmin = {
  id: "sa",
  isAdmin: true,
  organizationId: "other",
  orgStatus: "active" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.organization.findUnique.mockResolvedValue({
    id: "org-uuid-001",
    slug: "acme",
    name: "Acme",
    _count: {
      users: 0,
      assets: 0,
      accessories: 0,
      licences: 0,
      consumables: 0,
    },
  } as any);
  mockPrisma.organization.update.mockImplementation((async ({
    data,
  }: {
    data: Record<string, unknown>;
  }) => ({ id: "org-uuid-001", ...data })) as never);
  vi.mocked(requireApiAdmin).mockResolvedValue(orgAdmin as any);
  vi.mocked(requireWritableOrg).mockResolvedValue(undefined);
  vi.mocked(requireSuperAdmin).mockRejectedValue(
    new ForbiddenError("not_super_admin", "Super-admin access required"),
  );
});

describe("PUT /api/organizations/[id]", () => {
  it("does not let an org admin change isActive", async () => {
    const req = createMockRequest("/api/organizations/org-uuid-001", {
      method: "PUT",
      body: { name: "Acme", isActive: true },
    });
    await PUT(req, params);
    const data = mockPrisma.organization.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("isActive");
  });

  it("does not silently set isActive when the body omits it", async () => {
    const req = createMockRequest("/api/organizations/org-uuid-001", {
      method: "PUT",
      body: { name: "Acme" },
    });
    await PUT(req, params);
    expect(
      mockPrisma.organization.update.mock.calls[0][0].data,
    ).not.toHaveProperty("isActive");
  });

  it("lets a super-admin change isActive of another org", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue(superAdmin as any);
    vi.mocked(requireApiAdmin).mockResolvedValue(superAdmin as any);
    const req = createMockRequest("/api/organizations/org-uuid-001", {
      method: "PUT",
      body: { isActive: false },
    });
    const res = await PUT(req, params);
    expect((await parseResponse(res)).status).toBe(200);
    expect(mockPrisma.organization.update.mock.calls[0][0].data).toMatchObject({
      isActive: false,
    });
  });

  it("does not require a writable org when a super-admin acts on another org", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue(superAdmin as any);
    vi.mocked(requireApiAdmin).mockResolvedValue(superAdmin as any);
    const req = createMockRequest("/api/organizations/org-uuid-001", {
      method: "PUT",
      body: { isActive: true },
    });
    const res = await PUT(req, params);
    expect(res.status).toBe(200);
    expect(requireWritableOrg).not.toHaveBeenCalled();
  });

  it("does not set isActive when a super-admin omits it", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue(superAdmin as any);
    vi.mocked(requireApiAdmin).mockResolvedValue(superAdmin as any);
    const req = createMockRequest("/api/organizations/org-uuid-001", {
      method: "PUT",
      body: { name: "Renamed" },
    });
    await PUT(req, params);
    expect(
      mockPrisma.organization.update.mock.calls[0][0].data,
    ).not.toHaveProperty("isActive");
  });

  it("requires a writable org when an admin updates their own org", async () => {
    const req = createMockRequest("/api/organizations/org-uuid-001", {
      method: "PUT",
      body: { name: "Acme" },
    });
    const res = await PUT(req, params);
    expect(res.status).toBe(200);
    expect(requireWritableOrg).toHaveBeenCalledWith(orgAdmin);
  });

  it("answers 403 and writes nothing when the own org is read-only", async () => {
    vi.mocked(requireWritableOrg).mockRejectedValue(
      new ForbiddenError("org_read_only", "Organization is in read-only mode"),
    );
    const req = createMockRequest("/api/organizations/org-uuid-001", {
      method: "PUT",
      body: { name: "Acme" },
    });
    const res = await PUT(req, params);
    const { status, body } = await parseResponse<{ code: string }>(res);
    expect(status).toBe(403);
    expect(body.code).toBe("org_read_only");
    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
  });

  it("rejects an org admin editing another org with 404", async () => {
    const req = createMockRequest("/api/organizations/other-org", {
      method: "PUT",
      body: { name: "X" },
    });
    const res = await PUT(req, {
      params: Promise.resolve({ id: "other-org" }),
    });
    expect((await parseResponse(res)).status).toBe(404);
    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
  });

  it("maps an unauthenticated caller to 401", async () => {
    vi.mocked(requireApiAdmin).mockRejectedValue(new UnauthorizedError());
    const req = createMockRequest("/api/organizations/org-uuid-001", {
      method: "PUT",
      body: { name: "Acme" },
    });
    const res = await PUT(req, params);
    expect(res.status).toBe(401);
  });

  it("maps a non-admin caller to 403", async () => {
    vi.mocked(requireApiAdmin).mockRejectedValue(
      new ForbiddenError("not_admin", "Admin access required"),
    );
    const req = createMockRequest("/api/organizations/org-uuid-001", {
      method: "PUT",
      body: { name: "Acme" },
    });
    const res = await PUT(req, params);
    const { status, body } = await parseResponse<{ code: string }>(res);
    expect(status).toBe(403);
    expect(body.code).toBe("not_admin");
  });

  it("stores the parsed object, without isActive, in the audit entry", async () => {
    const req = createMockRequest("/api/organizations/org-uuid-001", {
      method: "PUT",
      body: { name: "Acme", isActive: true },
    });
    await PUT(req, params);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-uuid-001",
        entityId: "org-uuid-001",
        details: { name: "Acme" },
      }),
    );
  });

  it("never writes isActive on the tenant path, even if the schema let it through", async () => {
    const parse = vi
      .spyOn(updateOrganizationSchema, "parse")
      .mockReturnValue({ name: "Acme", isActive: true } as never);
    try {
      const req = createMockRequest("/api/organizations/org-uuid-001", {
        method: "PUT",
        body: { name: "Acme", isActive: true },
      });
      const res = await PUT(req, params);
      expect(res.status).toBe(200);
    } finally {
      parse.mockRestore();
    }
    const data = mockPrisma.organization.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("isActive");
  });

  it("returns 500 for an unexpected failure of the super-admin check", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(new Error("db down"));
    const req = createMockRequest("/api/organizations/org-uuid-001", {
      method: "PUT",
      body: { name: "Acme" },
    });
    const res = await PUT(req, params);
    expect(res.status).toBe(500);
    expect(mockPrisma.organization.update).not.toHaveBeenCalled();
  });
});

describe("GET /api/organizations/[id]", () => {
  it("returns the caller's own organization", async () => {
    const req = createMockRequest("/api/organizations/org-uuid-001");
    const res = await GET(req, params);
    expect(res.status).toBe(200);
  });

  it("answers 404 for another org when the caller is not a super-admin", async () => {
    const req = createMockRequest("/api/organizations/other-org");
    const res = await GET(req, {
      params: Promise.resolve({ id: "other-org" }),
    });
    expect(res.status).toBe(404);
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("returns another org to a super-admin", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue(superAdmin as any);
    vi.mocked(requireApiAdmin).mockResolvedValue(superAdmin as any);
    const req = createMockRequest("/api/organizations/org-uuid-001");
    const res = await GET(req, params);
    expect(res.status).toBe(200);
  });

  it("maps an unauthenticated caller to 401", async () => {
    vi.mocked(requireApiAdmin).mockRejectedValue(new UnauthorizedError());
    const req = createMockRequest("/api/organizations/org-uuid-001");
    const res = await GET(req, params);
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/organizations/[id]", () => {
  it("requires a writable org when an admin deletes their own org", async () => {
    vi.mocked(requireWritableOrg).mockRejectedValue(
      new ForbiddenError("org_read_only", "Organization is in read-only mode"),
    );
    const req = createMockRequest("/api/organizations/org-uuid-001", {
      method: "DELETE",
    });
    const res = await DELETE(req, params);
    expect(res.status).toBe(403);
    expect(mockPrisma.organization.delete).not.toHaveBeenCalled();
  });

  it("deletes an empty own organization", async () => {
    const req = createMockRequest("/api/organizations/org-uuid-001", {
      method: "DELETE",
    });
    const res = await DELETE(req, params);
    expect(res.status).toBe(200);
    expect(requireWritableOrg).toHaveBeenCalledWith(orgAdmin);
    expect(mockPrisma.organization.delete).toHaveBeenCalledWith({
      where: { id: "org-uuid-001" },
    });
  });

  it("rejects an org admin deleting another org with 404", async () => {
    const req = createMockRequest("/api/organizations/other-org", {
      method: "DELETE",
    });
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "other-org" }),
    });
    expect(res.status).toBe(404);
    expect(mockPrisma.organization.delete).not.toHaveBeenCalled();
  });

  it("does not require a writable org when a super-admin acts on another org", async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue(superAdmin as any);
    vi.mocked(requireApiAdmin).mockResolvedValue(superAdmin as any);
    const req = createMockRequest("/api/organizations/org-uuid-001", {
      method: "DELETE",
    });
    const res = await DELETE(req, params);
    expect(res.status).toBe(200);
    expect(requireWritableOrg).not.toHaveBeenCalled();
  });
});
