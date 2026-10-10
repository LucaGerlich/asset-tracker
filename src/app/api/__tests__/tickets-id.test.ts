import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/freshdesk", () => ({ createFreshdeskClient: vi.fn() }));
vi.mock("@/lib/encryption", () => ({ decrypt: (value: string) => value }));
vi.mock("@/lib/notifications", () => ({
  notifyTicketAssigned: vi.fn().mockResolvedValue(undefined),
  notifyTicketStatusChanged: vi.fn().mockResolvedValue(undefined),
}));

import { GET, PATCH } from "@/app/api/tickets/[id]/route";
import prisma from "@/lib/prisma";
import {
  requireApiAdmin,
  requireSuperAdmin,
  requireWritableOrg,
} from "@/lib/api-auth";
import { createFreshdeskClient } from "@/lib/freshdesk";
import { notifyTicketAssigned } from "@/lib/notifications";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);

const OWN_ORG = "org-uuid-001";
const OWN_ASSIGNEE = "11111111-1111-4111-8111-111111111111";
const FOREIGN_ASSIGNEE = "22222222-2222-4222-8222-222222222222";

const admin = {
  id: "admin-uuid-001",
  isAdmin: true,
  organizationId: OWN_ORG,
  orgStatus: "active" as const,
};

interface TicketWhere {
  id: string;
  user_tickets_createdByTouser?: { organizationId?: string };
}

const patch = (id: string, body: Record<string, unknown>) =>
  PATCH(createMockRequest(`/api/tickets/${id}`, { method: "PATCH", body }), {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireApiAdmin).mockResolvedValue(admin as never);
  vi.mocked(requireWritableOrg).mockResolvedValue(undefined);

  // In-memory stand-in with Prisma semantics: a missing org filter matches a
  // ticket of any org.
  mockPrisma.tickets.findFirst.mockImplementation((async ({
    where,
  }: {
    where: TicketWhere;
  }) => {
    const orgFilter = where.user_tickets_createdByTouser?.organizationId;
    return where.id === "ticket-own" &&
      (orgFilter === undefined || orgFilter === OWN_ORG)
      ? { status: "new", assignedTo: null, title: "Printer" }
      : null;
  }) as never);
  mockPrisma.tickets.update.mockResolvedValue({
    id: "ticket-own",
    user_tickets_createdByTouser: null,
    user_tickets_assignedToTouser: null,
  } as never);

  // In-memory stand-in with Prisma semantics: a missing org filter matches a
  // user of any org.
  mockPrisma.user.findFirst.mockImplementation((async ({
    where,
  }: {
    where: { userid: string; organizationId?: string };
  }) =>
    where.userid === OWN_ASSIGNEE &&
    (where.organizationId === undefined || where.organizationId === OWN_ORG)
      ? { userid: OWN_ASSIGNEE }
      : null) as never);
});

describe("PATCH /api/tickets/[id]", () => {
  it("updates a ticket of the caller's org", async () => {
    const res = await patch("ticket-own", { status: "open" });

    expect(res.status).toBe(200);
    expect(mockPrisma.tickets.update).toHaveBeenCalledTimes(1);
  });

  it("answers 404 and updates nothing for a ticket of another org", async () => {
    const res = await patch("ticket-foreign", { status: "open" });

    expect(res.status).toBe(404);
    expect(mockPrisma.tickets.update).not.toHaveBeenCalled();
  });

  it("answers 404 and updates nothing when the caller has no organization", async () => {
    vi.mocked(requireApiAdmin).mockResolvedValue({
      ...admin,
      organizationId: undefined,
    } as never);

    const res = await patch("ticket-own", { status: "open" });

    expect(res.status).toBe(404);
    expect(mockPrisma.tickets.update).not.toHaveBeenCalled();
  });

  describe("assignee", () => {
    it("assigns a user of the caller's org", async () => {
      const res = await patch("ticket-own", { assignedTo: OWN_ASSIGNEE });

      expect(res.status).toBe(200);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { userid: OWN_ASSIGNEE, organizationId: OWN_ORG },
        select: { userid: true },
      });
      expect(mockPrisma.tickets.update.mock.calls[0][0].data).toMatchObject({
        assignedTo: OWN_ASSIGNEE,
      });
    });

    it("answers 400, updates nothing and notifies nobody for a user of another org", async () => {
      mockPrisma.tickets.update.mockResolvedValue({
        id: "ticket-own",
        user_tickets_createdByTouser: null,
        user_tickets_assignedToTouser: {
          userid: FOREIGN_ASSIGNEE,
          email: "foreign@example.com",
          firstname: "Foreign",
          lastname: "User",
        },
      } as never);

      const res = await patch("ticket-own", { assignedTo: FOREIGN_ASSIGNEE });

      expect(res.status).toBe(400);
      expect(mockPrisma.tickets.update).not.toHaveBeenCalled();
      expect(notifyTicketAssigned).not.toHaveBeenCalled();
    });

    it("answers 400 for a user that does not exist", async () => {
      const res = await patch("ticket-own", {
        assignedTo: "33333333-3333-4333-8333-333333333333",
      });

      expect(res.status).toBe(400);
      expect(mockPrisma.tickets.update).not.toHaveBeenCalled();
    });

    it.each([
      ["a Prisma filter object", { not: "" }],
      ["a number", 42],
      ["an empty string", ""],
      ["a non-uuid string", "not-a-uuid"],
    ])("answers 400 without a user lookup for %s", async (_, assignedTo) => {
      const res = await patch("ticket-own", { assignedTo });

      expect(res.status).toBe(400);
      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.tickets.update).not.toHaveBeenCalled();
    });

    it("unassigns with null without a user lookup", async () => {
      const res = await patch("ticket-own", { assignedTo: null });

      expect(res.status).toBe(200);
      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.tickets.update.mock.calls[0][0].data).toMatchObject({
        assignedTo: null,
      });
    });
  });

  it("returns 403 and updates nothing when the org is read-only", async () => {
    vi.mocked(requireWritableOrg).mockRejectedValue(
      new ForbiddenError("org_read_only", "Organization is in read-only mode"),
    );

    const res = await patch("ticket-own", { status: "open" });

    expect(res.status).toBe(403);
    expect(mockPrisma.tickets.update).not.toHaveBeenCalled();
  });

  it("maps an unauthenticated caller to 401", async () => {
    vi.mocked(requireApiAdmin).mockRejectedValue(new UnauthorizedError());

    const res = await patch("ticket-own", { status: "open" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/tickets/[id] (Freshdesk)", () => {
  const get = (id: string) =>
    GET(createMockRequest(`/api/tickets/${id}`), {
      params: Promise.resolve({ id }),
    });

  beforeEach(() => {
    vi.mocked(requireSuperAdmin).mockResolvedValue(admin as never);
  });

  it("answers 403 and never touches Freshdesk for an admin who is not a super-admin", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(
      new ForbiddenError("not_super_admin", "Super-admin access required"),
    );

    const res = await get("42");

    expect(res.status).toBe(403);
    expect(mockPrisma.system_settings.findUnique).not.toHaveBeenCalled();
    expect(createFreshdeskClient).not.toHaveBeenCalled();
  });

  it("answers 401 for an unauthenticated caller", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(new UnauthorizedError());

    const res = await get("42");

    expect(res.status).toBe(401);
    expect(createFreshdeskClient).not.toHaveBeenCalled();
  });

  it("reads the shared Freshdesk settings for a super-admin", async () => {
    const res = await get("42");

    // No Freshdesk credentials are stored in this test, so the handler stops
    // right after the settings lookup, proving the guard let the caller in.
    expect(res.status).toBe(400);
    expect(mockPrisma.system_settings.findUnique).toHaveBeenCalledTimes(2);
    expect(requireApiAdmin).not.toHaveBeenCalled();
  });
});
