import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    role: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/api-auth", () => ({
  requireNotDemoMode: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn(),
  AUDIT_ACTIONS: { ROLE_CREATE: "role.create" },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET, POST } from "@/app/api/roles/route";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);

const adminSession = {
  user: {
    id: "admin-uuid-001",
    isAdmin: true,
    organizationId: "org-uuid-001",
  },
};

const regularSession = {
  user: {
    id: "user-uuid-001",
    isAdmin: false,
    organizationId: "org-uuid-001",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(adminSession as any);
  mockPrisma.user.findUnique.mockResolvedValue({
    organizationId: "org-uuid-001",
  } as any);
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

  it("returns 403 for non-admin users", async () => {
    mockAuth.mockResolvedValue(regularSession as any);

    const req = createMockRequest("/api/roles");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns 403 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as any);

    const req = createMockRequest("/api/roles");
    const res = await GET(req);
    expect(res.status).toBe(403);
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

  it("returns 403 for non-admin users", async () => {
    mockAuth.mockResolvedValue(regularSession as any);

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
});
