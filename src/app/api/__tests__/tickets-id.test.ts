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

import { PATCH } from "@/app/api/tickets/[id]/route";
import prisma from "@/lib/prisma";
import { requireApiAdmin, requireWritableOrg } from "@/lib/api-auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);

const OWN_ORG = "org-uuid-001";

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
