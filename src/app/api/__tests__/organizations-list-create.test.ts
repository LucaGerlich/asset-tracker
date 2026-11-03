import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";
import { expectAllowListSelect } from "./org-select-assertions";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn(),
  AUDIT_ACTIONS: { CREATE: "CREATE" },
}));

vi.mock("@/lib/super-admin", () => ({ isSuperAdmin: vi.fn() }));

import { GET, POST } from "@/app/api/organizations/route";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/api-auth";
import { isSuperAdmin } from "@/lib/super-admin";

const mockPrisma = vi.mocked(prisma, true);
const mockIsSuperAdmin = vi.mocked(isSuperAdmin);

beforeEach(() => {
  vi.clearAllMocks();
  mockIsSuperAdmin.mockResolvedValue(false);
  mockPrisma.organization.findMany.mockResolvedValue([]);
  mockPrisma.organization.count.mockResolvedValue(0);
  mockPrisma.organization.findUnique.mockResolvedValue(null);
  mockPrisma.organization.create.mockResolvedValue({
    id: "org-new",
    name: "New",
    slug: "new",
  } as never);
});

describe("GET /api/organizations", () => {
  it("selects only tenant-visible fields without pagination", async () => {
    await GET(createMockRequest("/api/organizations"));
    expectAllowListSelect(mockPrisma.organization.findMany.mock.calls[0][0]);
  });

  it("selects only tenant-visible fields with pagination", async () => {
    await GET(createMockRequest("/api/organizations?page=1"));
    expectAllowListSelect(mockPrisma.organization.findMany.mock.calls[0][0]);
  });

  it("still returns the relation counts the settings UI reads", async () => {
    await GET(createMockRequest("/api/organizations"));
    const args = mockPrisma.organization.findMany.mock.calls[0][0] as {
      select: { _count: unknown };
    };
    expect(args.select._count).toEqual({
      select: { users: true, assets: true, departments: true },
    });
  });
});

describe("GET /api/organizations for an org-less caller", () => {
  beforeEach(() => {
    vi.mocked(requirePermission).mockResolvedValueOnce({
      id: "user-1",
      email: "orgless@test.com",
      organizationId: null,
    } as never);
  });

  it("returns an empty list instead of every tenant", async () => {
    const res = await GET(createMockRequest("/api/organizations"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(mockPrisma.organization.findMany).not.toHaveBeenCalled();
  });

  it("returns an empty page when paginated", async () => {
    const res = await GET(createMockRequest("/api/organizations?page=1"));

    expect(res.status).toBe(200);
    expect(mockPrisma.organization.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.organization.count).not.toHaveBeenCalled();
  });

  it("lists all organizations for a super-admin", async () => {
    mockIsSuperAdmin.mockResolvedValue(true);

    await GET(createMockRequest("/api/organizations"));

    expect(mockIsSuperAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ email: "orgless@test.com" }),
    );
    expect(mockPrisma.organization.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.organization.findMany.mock.calls[0][0]?.where).toEqual(
      {},
    );
  });
});

describe("POST /api/organizations", () => {
  it("returns only tenant-visible fields of the created organization", async () => {
    const res = await POST(
      createMockRequest("/api/organizations", {
        method: "POST",
        body: { name: "New", slug: "new" },
      }),
    );
    expect(res.status).toBe(201);
    expectAllowListSelect(mockPrisma.organization.create.mock.calls[0][0]);
  });
});
