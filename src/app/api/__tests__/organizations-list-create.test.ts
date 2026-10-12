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

import { GET, POST } from "@/app/api/organizations/route";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, true);

beforeEach(() => {
  vi.clearAllMocks();
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
