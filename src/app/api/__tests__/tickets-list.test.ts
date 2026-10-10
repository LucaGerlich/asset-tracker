import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/freshdesk", () => ({
  createFreshdeskClient: vi.fn(),
  SUPPORTED_TICKET_TYPES: ["Hardware Request"],
}));
vi.mock("@/lib/encryption", () => ({ decrypt: (value: string) => value }));

import { GET } from "@/app/api/tickets/route";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";

const mockPrisma = vi.mocked(prisma, true);

const OWN_ORG = "org-uuid-001";

const admin = {
  id: "admin-uuid-001",
  isAdmin: true,
  organizationId: OWN_ORG,
  orgStatus: "active" as const,
};

const orglessAdmin = { ...admin, organizationId: undefined };

const list = (query = "") => GET(createMockRequest(`/api/tickets${query}`));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireApiAuth).mockResolvedValue(admin as never);
  mockPrisma.tickets.findMany.mockResolvedValue([]);
  mockPrisma.tickets.count.mockResolvedValue(0);
});

describe("GET /api/tickets (local list scoping)", () => {
  it("scopes an admin's list to tickets created by users of their org", async () => {
    await list();

    expect(mockPrisma.tickets.findMany.mock.calls[0][0]?.where).toEqual({
      user_tickets_createdByTouser: { organizationId: OWN_ORG },
    });
  });

  it("limits a non-admin to their own tickets", async () => {
    vi.mocked(requireApiAuth).mockResolvedValue({
      ...admin,
      id: "member-uuid-001",
      isAdmin: false,
    } as never);

    await list();

    expect(mockPrisma.tickets.findMany.mock.calls[0][0]?.where).toEqual({
      createdBy: "member-uuid-001",
    });
  });

  it("lists nothing for an admin without an organization", async () => {
    vi.mocked(requireApiAuth).mockResolvedValue(orglessAdmin as never);

    const { status, body } = await parseResponse<unknown[]>(await list());

    expect(status).toBe(200);
    expect(body).toEqual([]);
    expect(mockPrisma.tickets.findMany).not.toHaveBeenCalled();
  });

  it("answers an empty page for a paginated list of an admin without an organization", async () => {
    vi.mocked(requireApiAuth).mockResolvedValue(orglessAdmin as never);

    const { status, body } = await parseResponse<{
      data: unknown[];
      total: number;
    }>(await list("?page=2&pageSize=10&search=printer"));

    expect(status).toBe(200);
    expect(body).toMatchObject({
      data: [],
      total: 0,
      page: 2,
      pageSize: 10,
      totalPages: 0,
    });
    expect(mockPrisma.tickets.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.tickets.count).not.toHaveBeenCalled();
  });
});
