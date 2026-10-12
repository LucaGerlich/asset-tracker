import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/freshdesk", () => ({
  createFreshdeskClient: vi.fn(),
  SUPPORTED_TICKET_TYPES: ["Hardware Request", "Problem"],
}));
vi.mock("@/lib/encryption", () => ({ decrypt: (value: string) => value }));

import { GET } from "@/app/api/tickets/route";
import prisma from "@/lib/prisma";
import {
  requireApiAdmin,
  requireApiAuth,
  requireSuperAdmin,
} from "@/lib/api-auth";
import { createFreshdeskClient } from "@/lib/freshdesk";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);

const superAdmin = {
  id: "super-uuid-001",
  isAdmin: true,
  organizationId: "org-uuid-001",
  orgStatus: "active" as const,
};

const getFreshdesk = () =>
  GET(createMockRequest("/api/tickets?source=freshdesk"));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSuperAdmin).mockResolvedValue(superAdmin as never);
  vi.mocked(requireApiAuth).mockResolvedValue({
    ...superAdmin,
    isAdmin: false,
  } as never);
});

describe("GET /api/tickets?source=freshdesk", () => {
  it("answers 403 and never touches Freshdesk for an admin who is not a super-admin", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(
      new ForbiddenError("not_super_admin", "Super-admin access required"),
    );

    const res = await getFreshdesk();

    expect(res.status).toBe(403);
    expect(mockPrisma.system_settings.findUnique).not.toHaveBeenCalled();
    expect(createFreshdeskClient).not.toHaveBeenCalled();
  });

  it("answers 401 for an unauthenticated caller", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(new UnauthorizedError());

    const res = await getFreshdesk();

    expect(res.status).toBe(401);
  });

  it("reads the shared Freshdesk settings for a super-admin", async () => {
    const res = await getFreshdesk();

    // No Freshdesk credentials are stored in this test, so the handler stops
    // right after the settings lookup, proving the guard let the caller in.
    expect(res.status).toBe(400);
    expect(mockPrisma.system_settings.findUnique).toHaveBeenCalledTimes(2);
    expect(requireApiAdmin).not.toHaveBeenCalled();
  });
});

describe("GET /api/tickets (local)", () => {
  it("does not require a super-admin for the local ticket list", async () => {
    mockPrisma.tickets.findMany.mockResolvedValue([] as never);

    const res = await GET(createMockRequest("/api/tickets"));

    expect(res.status).toBe(200);
    expect(requireSuperAdmin).not.toHaveBeenCalled();
    expect(requireApiAuth).toHaveBeenCalledTimes(1);
  });
});
