import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/api-auth", () => ({
  requireApiAuth: vi.fn(),
  requireNotDemoMode: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn().mockResolvedValue({
    organization: { id: "org-uuid-001" },
  }),
  scopeToOrganization: vi.fn((where: any) => ({
    ...where,
    organizationId: "org-uuid-001",
  })),
}));

vi.mock("@/lib/auth-utils", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_password"),
}));

vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from "@/app/api/user/route";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { hasPermission } from "@/lib/rbac";

const mockPrisma = vi.mocked(prisma);
const mockRequireAuth = vi.mocked(requireApiAuth);

const adminUser = {
  id: "admin-uuid-001",
  isAdmin: true,
  organizationId: "org-uuid-001",
};

const regularUser = {
  id: "user-uuid-001",
  isAdmin: false,
  organizationId: "org-uuid-001",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue(adminUser as any);
  vi.mocked(hasPermission).mockResolvedValue(true);
});

describe("GET /api/user", () => {
  const mockUserData = {
    userid: "user-uuid-001",
    firstname: "Test",
    lastname: "User",
    email: "test@example.com",
    password: "hashed_secret",
    isadmin: false,
  };

  it("returns user list for admin", async () => {
    mockPrisma.user.findMany.mockResolvedValue([mockUserData] as any);

    const req = createMockRequest("/api/user");
    const res = await GET(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it("strips password from response", async () => {
    mockPrisma.user.findMany.mockResolvedValue([mockUserData] as any);

    const req = createMockRequest("/api/user");
    const res = await GET(req);
    const { body } = await parseResponse<any>(res);

    expect(body[0]).not.toHaveProperty("password");
  });

  it("returns single user by id", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUserData as any);

    const req = createMockRequest("/api/user?id=user-uuid-001");
    const res = await GET(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(200);
    expect(body).not.toHaveProperty("password");
  });

  it("returns 404 when user not found by id", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const req = createMockRequest("/api/user?id=nonexistent");
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new Error("Unauthorized"));

    const req = createMockRequest("/api/user");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when regular user lacks user:view permission", async () => {
    mockRequireAuth.mockResolvedValue(regularUser as any);
    vi.mocked(hasPermission).mockResolvedValue(false);

    const req = createMockRequest("/api/user");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("allows regular user to view their own profile", async () => {
    mockRequireAuth.mockResolvedValue(regularUser as any);
    vi.mocked(hasPermission).mockResolvedValue(false);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...mockUserData,
      userid: "user-uuid-001",
    } as any);

    const req = createMockRequest("/api/user?id=user-uuid-001");
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});
