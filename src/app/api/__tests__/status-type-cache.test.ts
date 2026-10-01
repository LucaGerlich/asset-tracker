import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/api-auth", () => ({
  requireApiAuth: vi.fn().mockResolvedValue({ id: "user-1" }),
  requireApiAdmin: vi.fn(),
  requireNotDemoMode: vi.fn(),
}));
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn(),
}));
vi.mock("@/lib/cache", () => ({
  cached: vi.fn(async (_key: string, fn: () => Promise<unknown>) => fn()),
  invalidateCacheByPrefix: vi.fn(),
}));

import { GET } from "@/app/api/statusType/route";
import prisma from "@/lib/prisma";
import { cached } from "@/lib/cache";
import { getOrganizationContext } from "@/lib/organization-context";

const mockPrisma = vi.mocked(prisma, true);
const mockCached = vi.mocked(cached);
const mockOrgContext = vi.mocked(getOrganizationContext);

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.statusType.findMany.mockResolvedValue([]);
});

describe("GET /api/statusType cache isolation", () => {
  it("keys the unpaginated cache by organization", async () => {
    mockOrgContext.mockResolvedValue({
      organization: { id: "org-a" },
    } as never);
    await GET(createMockRequest("/api/statusType"));
    mockOrgContext.mockResolvedValue({
      organization: { id: "org-b" },
    } as never);
    await GET(createMockRequest("/api/statusType"));

    const keys = mockCached.mock.calls.map((call) => call[0]);
    expect(keys).toEqual(["status_types:org-a", "status_types:org-b"]);
  });

  it("uses a distinct key when no organization is resolved", async () => {
    mockOrgContext.mockResolvedValue(null);
    await GET(createMockRequest("/api/statusType"));
    expect(mockCached.mock.calls[0]?.[0]).toBe("status_types:global");
  });
});
