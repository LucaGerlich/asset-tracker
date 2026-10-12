import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/email/service", () => ({
  queueEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/notifications", () => ({
  notifyTicketComment: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn(),
  AUDIT_ACTIONS: { UPDATE: "UPDATE" },
  AUDIT_ENTITIES: { AUDIT_CAMPAIGN: "audit_campaign" },
}));

import { POST as completeMaintenance } from "@/app/api/maintenance/[id]/complete/route";
import { POST as activateAudit } from "@/app/api/audits/[id]/activate/route";
import { POST as commentOnTicket } from "@/app/api/tickets/[id]/comments/route";
import { PUT as reassignUserAsset } from "@/app/api/userAssets/update/route";
import prisma from "@/lib/prisma";
import {
  requireApiAuth,
  requireApiAdmin,
  requirePermission,
} from "@/lib/api-auth";
import { queueEmail } from "@/lib/email/service";
import { notifyTicketComment } from "@/lib/notifications";

const mockPrisma = vi.mocked(prisma, true);

const OWN_ORG = "org-uuid-001";
const OTHER_ORG = "org-uuid-002";

const caller = (overrides: Record<string, unknown> = {}) => ({
  id: "admin-uuid-001",
  isAdmin: true,
  organizationId: OWN_ORG,
  orgStatus: "active" as const,
  ...overrides,
});

const actAs = (overrides: Record<string, unknown> = {}) => {
  const user = caller(overrides) as never;
  vi.mocked(requireApiAuth).mockResolvedValue(user);
  vi.mocked(requireApiAdmin).mockResolvedValue(user);
  vi.mocked(requirePermission).mockResolvedValue(user);
};

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  actAs();
});

describe("POST /api/maintenance/[id]/complete", () => {
  const schedule = {
    id: "sched-1",
    assetId: "asset-1",
    title: "Service",
    frequency: "monthly",
    nextDueDate: new Date("2026-01-15"),
    assignedTo: "tech-1",
  };

  const complete = () =>
    completeMaintenance(
      createMockRequest("/api/maintenance/sched-1/complete", {
        method: "POST",
        body: { notes: "done" },
      }),
      params("sched-1"),
    );

  beforeEach(() => {
    // Only the schedule of an asset in OWN_ORG exists for the caller.
    mockPrisma.maintenance_schedules.findFirst.mockImplementation((async ({
      where,
    }: {
      where: { id: string; asset?: { organizationId?: string } };
    }) =>
      where.asset?.organizationId === OWN_ORG ? schedule : null) as never);
    mockPrisma.maintenance_schedules.findUnique.mockResolvedValue(
      schedule as never,
    );
    mockPrisma.$transaction.mockImplementation((async (ops: unknown[]) =>
      Promise.all(ops)) as never);
    mockPrisma.maintenance_logs.create.mockResolvedValue({
      id: "log-1",
    } as never);
    mockPrisma.maintenance_schedules.update.mockResolvedValue({
      ...schedule,
      assignedTo: "tech-1",
      user: {
        firstname: "T",
        lastname: "Tech",
        email: "tech@example.com",
        organizationId: OWN_ORG,
      },
      asset: { assetname: "Laptop" },
    } as never);
  });

  it("completes a schedule of an asset in the caller's organization", async () => {
    const res = await complete();

    expect(res.status).toBe(201);
    expect(mockPrisma.maintenance_schedules.findFirst).toHaveBeenCalledWith({
      where: { id: "sched-1", asset: { organizationId: OWN_ORG } },
    });
    expect(mockPrisma.maintenance_logs.create).toHaveBeenCalled();
    expect(queueEmail).toHaveBeenCalled();
  });

  it("does not email an assignee of another organization", async () => {
    mockPrisma.maintenance_schedules.update.mockResolvedValue({
      ...schedule,
      user: {
        firstname: "F",
        lastname: "Foreign",
        email: "foreign@example.com",
        organizationId: OTHER_ORG,
      },
      asset: { assetname: "Laptop" },
    } as never);

    const res = await complete();

    expect(res.status).toBe(201);
    expect(queueEmail).not.toHaveBeenCalled();
  });

  it("answers 404 and writes nothing for another organization's schedule", async () => {
    actAs({ organizationId: OTHER_ORG });

    const res = await complete();

    expect(res.status).toBe(404);
    expect(mockPrisma.maintenance_logs.create).not.toHaveBeenCalled();
    expect(mockPrisma.maintenance_schedules.update).not.toHaveBeenCalled();
    expect(queueEmail).not.toHaveBeenCalled();
  });

  it("answers 404 without querying when the caller has no organization", async () => {
    actAs({ organizationId: undefined });

    const res = await complete();

    expect(res.status).toBe(404);
    expect(mockPrisma.maintenance_schedules.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.maintenance_schedules.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.maintenance_logs.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/audits/[id]/activate", () => {
  const campaigns = [
    {
      id: "camp-own",
      organizationId: OWN_ORG,
      status: "draft",
      scopeType: "all",
      scopeId: null,
    },
    {
      id: "camp-foreign",
      organizationId: OTHER_ORG,
      status: "draft",
      scopeType: "all",
      scopeId: null,
    },
  ];

  const activate = (id: string) =>
    activateAudit(
      createMockRequest(`/api/audits/${id}/activate`, { method: "POST" }),
      params(id),
    );

  beforeEach(() => {
    mockPrisma.auditCampaign.findFirst.mockImplementation(
      (async ({ where }: { where: { id: string; organizationId?: string } }) =>
        campaigns.find(
          (c) =>
            c.id === where.id &&
            (where.organizationId === undefined ||
              c.organizationId === where.organizationId),
        ) ?? null) as never,
    );
    mockPrisma.auditCampaign.findUnique.mockImplementation(
      (async ({ where }: { where: { id: string } }) =>
        campaigns.find((c) => c.id === where.id) ?? null) as never,
    );
    mockPrisma.asset.findMany.mockResolvedValue([
      { assetid: "asset-1" },
    ] as never);
    mockPrisma.$transaction.mockImplementation((async (ops: unknown[]) =>
      Promise.all(ops)) as never);
  });

  it("activates a draft campaign of the caller's organization with that organization's assets", async () => {
    const res = await activate("camp-own");

    expect(res.status).toBe(200);
    expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: OWN_ORG }),
      }),
    );
    expect(mockPrisma.auditEntry.createMany).toHaveBeenCalled();
  });

  it("answers 404 and activates nothing for another organization's campaign", async () => {
    const res = await activate("camp-foreign");

    expect(res.status).toBe(404);
    expect(mockPrisma.auditCampaign.update).not.toHaveBeenCalled();
    expect(mockPrisma.auditEntry.createMany).not.toHaveBeenCalled();
  });

  it("answers 404 without querying when the caller has no organization", async () => {
    actAs({ organizationId: undefined });

    const res = await activate("camp-own");

    expect(res.status).toBe(404);
    expect(mockPrisma.auditCampaign.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.auditCampaign.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/tickets/[id]/comments", () => {
  const tickets = [
    {
      id: "ticket-own",
      title: "Own",
      createdBy: "creator-own",
      organizationId: OWN_ORG,
      user_tickets_createdByTouser: {
        userid: "creator-own",
        firstname: "Cora",
        lastname: "Own",
        email: "cora@own.example",
      },
    },
    {
      id: "ticket-foreign",
      title: "Foreign",
      createdBy: "creator-foreign",
      organizationId: OTHER_ORG,
      user_tickets_createdByTouser: {
        userid: "creator-foreign",
        firstname: "Fred",
        lastname: "Foreign",
        email: "fred@foreign.example",
      },
    },
  ];

  const comment = (id: string) =>
    commentOnTicket(
      createMockRequest(`/api/tickets/${id}/comments`, {
        method: "POST",
        body: { comment: "Hello" },
      }),
      params(id),
    );

  beforeEach(() => {
    mockPrisma.tickets.findFirst.mockImplementation((async ({
      where,
    }: {
      where: {
        id: string;
        user_tickets_createdByTouser?: { organizationId?: string };
      };
    }) => {
      const orgFilter = where.user_tickets_createdByTouser?.organizationId;
      return (
        tickets.find(
          (t) =>
            t.id === where.id &&
            (orgFilter === undefined || t.organizationId === orgFilter),
        ) ?? null
      );
    }) as never);
    mockPrisma.tickets.findUnique.mockImplementation(
      (async ({ where }: { where: { id: string } }) =>
        tickets.find((t) => t.id === where.id) ?? null) as never,
    );
    mockPrisma.ticket_comments.create.mockResolvedValue({
      id: "c-1",
      user: { firstname: "Admin", lastname: "User" },
    } as never);
  });

  it("comments on a ticket of the caller's organization and notifies its creator", async () => {
    const res = await comment("ticket-own");

    expect(res.status).toBe(201);
    expect(mockPrisma.ticket_comments.create).toHaveBeenCalled();
    expect(notifyTicketComment).toHaveBeenCalledWith(
      "Own",
      "ticket-own",
      "cora@own.example",
      "creator-own",
      "Cora Own",
      expect.any(String),
      "Hello",
    );
  });

  it("answers 404 and sends no email for another organization's ticket", async () => {
    const res = await comment("ticket-foreign");

    expect(res.status).toBe(404);
    expect(mockPrisma.ticket_comments.create).not.toHaveBeenCalled();
    expect(notifyTicketComment).not.toHaveBeenCalled();
  });

  it("answers 404 without querying when the caller has no organization", async () => {
    actAs({ organizationId: undefined });

    const res = await comment("ticket-own");

    expect(res.status).toBe(404);
    expect(mockPrisma.tickets.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.ticket_comments.create).not.toHaveBeenCalled();
    expect(notifyTicketComment).not.toHaveBeenCalled();
  });
});

describe("PUT /api/userAssets/update", () => {
  const OWN_USER = "11111111-1111-4111-8111-111111111111";
  const FOREIGN_USER = "22222222-2222-4222-8222-222222222222";

  const assignments = [
    { userassetsid: "ua-own", organizationId: OWN_ORG },
    { userassetsid: "ua-foreign", organizationId: OTHER_ORG },
  ];
  const users = [
    { userid: OWN_USER, organizationId: OWN_ORG },
    { userid: FOREIGN_USER, organizationId: OTHER_ORG },
  ];

  const reassign = (userAssetsId: string, userId: string) =>
    reassignUserAsset(
      createMockRequest("/api/userAssets/update", {
        method: "PUT",
        body: { userAssetsId, userId },
      }) as never,
    );

  beforeEach(() => {
    mockPrisma.userAssets.findFirst.mockImplementation((async ({
      where,
    }: {
      where: { userassetsid: string; asset?: { organizationId?: string } };
    }) => {
      const orgFilter = where.asset?.organizationId;
      return (
        assignments.find(
          (a) =>
            a.userassetsid === where.userassetsid &&
            (orgFilter === undefined || a.organizationId === orgFilter),
        ) ?? null
      );
    }) as never);
    mockPrisma.user.findFirst.mockImplementation(
      (async ({
        where,
      }: {
        where: { userid: string; organizationId?: string };
      }) =>
        users.find(
          (u) =>
            u.userid === where.userid &&
            (where.organizationId === undefined ||
              u.organizationId === where.organizationId),
        ) ?? null) as never,
    );
    mockPrisma.userAssets.update.mockResolvedValue({
      userassetsid: "ua-own",
    } as never);
  });

  it("re-points an assignment of the caller's organization to a user of that organization", async () => {
    const res = await reassign("ua-own", OWN_USER);

    expect(res.status).toBe(200);
    expect(mockPrisma.userAssets.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userassetsid: "ua-own" },
        data: expect.objectContaining({ userid: OWN_USER }),
      }),
    );
  });

  it("answers 404 for another organization's assignment", async () => {
    const res = await reassign("ua-foreign", OWN_USER);

    expect(res.status).toBe(404);
    expect(mockPrisma.userAssets.update).not.toHaveBeenCalled();
  });

  it("answers 404 when the target user belongs to another organization", async () => {
    const res = await reassign("ua-own", FOREIGN_USER);

    expect(res.status).toBe(404);
    expect(mockPrisma.userAssets.update).not.toHaveBeenCalled();
  });

  it("answers 404 without querying when the caller has no organization", async () => {
    actAs({ organizationId: undefined });

    const res = await reassign("ua-own", OWN_USER);

    expect(res.status).toBe(404);
    expect(mockPrisma.userAssets.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.userAssets.update).not.toHaveBeenCalled();
  });
});
