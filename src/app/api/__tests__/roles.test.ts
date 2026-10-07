import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");

vi.mock("@/lib/api-auth");

vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn(),
  AUDIT_ACTIONS: { ROLE_CREATE: "role.create" },
}));

vi.mock("@/lib/logger");

import { GET, POST } from "@/app/api/roles/route";
import prisma from "@/lib/prisma";
import { requireApiAdmin, requireWritableOrg } from "@/lib/api-auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);

const adminUser = {
  id: "admin-uuid-001",
  isAdmin: true,
  organizationId: "org-uuid-001",
  orgStatus: "active" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireApiAdmin).mockResolvedValue(adminUser as any);
  vi.mocked(requireWritableOrg).mockResolvedValue(undefined);
});

describe("GET /api/roles", () => {
  it("returns roles list for admin", async () => {
    const mockRoles = [
      { id: "role-1", name: "Admin", isSystem: true, permissions: [] },
      { id: "role-2", name: "Manager", isSystem: false, permissions: [] },
    ];
    mockPrisma.role.findMany.mockResolvedValue(mockRoles as any);

    const req = createMockRequest("/api/roles");
    const res = await GET(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
  });

  it("scopes the list to the admin's org plus system roles", async () => {
    mockPrisma.role.findMany.mockResolvedValue([]);

    await GET(createMockRequest("/api/roles"));

    expect(mockPrisma.role.findMany.mock.calls[0][0]?.where).toEqual({
      OR: [{ organizationId: "org-uuid-001" }, { organizationId: null }],
    });
  });

  it("returns 403 for non-admin users", async () => {
    vi.mocked(requireApiAdmin).mockRejectedValue(
      new ForbiddenError("not_admin", "Admin access required"),
    );

    const req = createMockRequest("/api/roles");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(requireApiAdmin).mockRejectedValue(new UnauthorizedError());

    const req = createMockRequest("/api/roles");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/roles", () => {
  it("creates a role with valid permissions", async () => {
    mockPrisma.role.findFirst.mockResolvedValue(null);
    mockPrisma.role.create.mockResolvedValue({
      id: "new-role-id",
      name: "Custom Role",
      permissions: ["asset:view", "asset:create"],
    } as any);

    const req = createMockRequest("/api/roles", {
      method: "POST",
      body: {
        name: "Custom Role",
        description: "A custom role",
        permissions: ["asset:view", "asset:create"],
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(201);
    expect(body.name).toBe("Custom Role");
  });

  it("returns 400 for invalid permission names", async () => {
    const req = createMockRequest("/api/roles", {
      method: "POST",
      body: {
        name: "Bad Role",
        permissions: ["invalid:permission", "also:invalid"],
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(400);
    expect(body.error).toContain("Invalid permissions");
  });

  it("returns 400 for duplicate role name", async () => {
    mockPrisma.role.findFirst.mockResolvedValue({
      id: "existing-role",
      name: "Existing Role",
    } as any);

    const req = createMockRequest("/api/roles", {
      method: "POST",
      body: {
        name: "Existing Role",
        permissions: ["asset:view"],
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(400);
    expect(body.error).toContain("already exists");
  });

  it("creates the role in the admin's own org", async () => {
    mockPrisma.role.findFirst.mockResolvedValue(null);
    mockPrisma.role.create.mockResolvedValue({
      id: "new-role-id",
      name: "Custom Role",
      permissions: ["asset:view"],
    } as any);

    const req = createMockRequest("/api/roles", {
      method: "POST",
      body: {
        name: "Custom Role",
        permissions: ["asset:view"],
        organizationId: "00000000-0000-4000-8000-000000000999",
      },
    });
    await POST(req);

    expect(mockPrisma.role.create.mock.calls[0][0].data).toMatchObject({
      organizationId: "org-uuid-001",
      isSystem: false,
    });
  });

  it("returns 403 for non-admin users", async () => {
    vi.mocked(requireApiAdmin).mockRejectedValue(
      new ForbiddenError("not_admin", "Admin access required"),
    );

    const req = createMockRequest("/api/roles", {
      method: "POST",
      body: {
        name: "Sneaky Role",
        permissions: ["asset:view"],
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 and creates nothing when the org is read-only", async () => {
    vi.mocked(requireWritableOrg).mockRejectedValue(
      new ForbiddenError("org_read_only", "Organization is in read-only mode"),
    );

    const req = createMockRequest("/api/roles", {
      method: "POST",
      body: {
        name: "Custom Role",
        permissions: ["asset:view"],
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<{ code: string }>(res);

    expect(status).toBe(403);
    expect(body.code).toBe("org_read_only");
    expect(mockPrisma.role.create).not.toHaveBeenCalled();
  });
});
