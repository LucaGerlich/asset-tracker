import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/integrations/slack-teams", () => ({
  notifyIntegrations: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/cache", () => ({
  invalidateCacheByPrefix: vi.fn().mockResolvedValue(undefined),
}));

import {
  GET as listWorkflow,
  POST as createTransition,
  DELETE as deleteTransition,
} from "@/app/api/admin/status-workflow/route";
import { GET as listTransitions } from "@/app/api/status-transitions/route";
import { PUT as updateStatus } from "@/app/api/asset/updateStatus/route";
import prisma from "@/lib/prisma";
import {
  requireApiAdmin,
  requireApiAuth,
  requirePermission,
} from "@/lib/api-auth";

const mockPrisma = vi.mocked(prisma, true);

const ORG_A = "org-a";
const ORG_B = "org-b";

const A_NEW = "status-a-new";
const A_USED = "status-a-in-use";
const A_DONE = "status-a-done";
const B_NEW = "status-b-new";
const B_USED = "status-b-in-use";

const statuses = [
  { statustypeid: A_NEW, statustypename: "New", organizationId: ORG_A },
  { statustypeid: A_USED, statustypename: "In use", organizationId: ORG_A },
  { statustypeid: A_DONE, statustypename: "Done", organizationId: ORG_A },
  { statustypeid: B_NEW, statustypename: "New", organizationId: ORG_B },
  { statustypeid: B_USED, statustypename: "In use", organizationId: ORG_B },
];

type Transition = {
  id: string;
  fromStatusId: string;
  toStatusId: string;
};

// Org A has a workflow (New -> In use), org B has none.
let transitions: Transition[];

const statusOf = (id: string) => statuses.find((s) => s.statustypeid === id);

type TransitionWhere = {
  id?: string;
  fromStatusId?: string;
  toStatusId?: string;
  fromStatus?: { organizationId?: string };
  toStatus?: { organizationId?: string };
};

/** Prisma semantics for the filters the routes use, over the in-memory rows. */
function transitionMatches(t: Transition, where: TransitionWhere = {}) {
  const from = statusOf(t.fromStatusId);
  const to = statusOf(t.toStatusId);
  return (
    (where.id === undefined || t.id === where.id) &&
    (where.fromStatusId === undefined ||
      t.fromStatusId === where.fromStatusId) &&
    (where.toStatusId === undefined || t.toStatusId === where.toStatusId) &&
    (where.fromStatus?.organizationId === undefined ||
      from?.organizationId === where.fromStatus.organizationId) &&
    (where.toStatus?.organizationId === undefined ||
      to?.organizationId === where.toStatus.organizationId)
  );
}

const admin = (organizationId: string | undefined) => ({
  id: "admin-uuid-001",
  isAdmin: true,
  organizationId,
  orgStatus: "active" as const,
});

const actAs = (organizationId: string | undefined) => {
  vi.mocked(requireApiAdmin).mockResolvedValue(admin(organizationId) as never);
  vi.mocked(requireApiAuth).mockResolvedValue(admin(organizationId) as never);
  vi.mocked(requirePermission).mockResolvedValue(
    admin(organizationId) as never,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  actAs(ORG_A);
  transitions = [{ id: "t-a-1", fromStatusId: A_NEW, toStatusId: A_USED }];

  mockPrisma.status_transitions.findMany.mockImplementation((async (
    args: { where?: TransitionWhere } = {},
  ) => transitions.filter((t) => transitionMatches(t, args.where))) as never);
  mockPrisma.status_transitions.findFirst.mockImplementation(
    (async (args: { where?: TransitionWhere }) =>
      transitions.find((t) => transitionMatches(t, args.where)) ??
      null) as never,
  );
  mockPrisma.status_transitions.count.mockImplementation(
    (async (args: { where?: TransitionWhere } = {}) =>
      transitions.filter((t) => transitionMatches(t, args.where))
        .length) as never,
  );
  // The lockout this fixes: an unscoped lookup would find org A's rows.
  mockPrisma.status_transitions.findUnique.mockImplementation(
    (async (args: {
      where: { fromStatusId_toStatusId: Omit<Transition, "id"> };
    }) =>
      transitions.find((t) =>
        transitionMatches(t, args.where.fromStatusId_toStatusId),
      ) ?? null) as never,
  );
  mockPrisma.status_transitions.create.mockImplementation((async (args: {
    data: Omit<Transition, "id">;
  }) => ({ id: "t-new", ...args.data })) as never);
  mockPrisma.status_transitions.deleteMany.mockImplementation((async (args: {
    where: TransitionWhere;
  }) => ({
    count: transitions.filter((t) => transitionMatches(t, args.where)).length,
  })) as never);
  mockPrisma.status_transitions.delete.mockResolvedValue({} as never);

  mockPrisma.statusType.findMany.mockImplementation((async (args: {
    where: { statustypeid: { in: string[] }; organizationId?: string };
  }) =>
    statuses.filter(
      (s) =>
        args.where.statustypeid.in.includes(s.statustypeid) &&
        (args.where.organizationId === undefined ||
          s.organizationId === args.where.organizationId),
    )) as never);
  mockPrisma.statusType.findFirst.mockImplementation(
    (async (args: {
      where: {
        statustypeid?: string;
        statustypename?: { equals: string };
        organizationId?: string;
      };
    }) =>
      statuses.find(
        (s) =>
          (args.where.statustypeid === undefined ||
            s.statustypeid === args.where.statustypeid) &&
          (args.where.statustypename === undefined ||
            s.statustypename.toLowerCase() ===
              args.where.statustypename.equals.toLowerCase()) &&
          (args.where.organizationId === undefined ||
            s.organizationId === args.where.organizationId),
      ) ?? null) as never,
  );
});

describe("GET /api/admin/status-workflow", () => {
  it("lists only transitions between statuses of the caller's organization", async () => {
    transitions.push({
      id: "t-b-1",
      fromStatusId: B_NEW,
      toStatusId: B_USED,
    });

    const res = await listWorkflow();
    const { status, body } = await parseResponse<Array<{ id: string }>>(res);

    expect(status).toBe(200);
    expect(body.map((t) => t.id)).toEqual(["t-a-1"]);
    expect(mockPrisma.status_transitions.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          fromStatus: { organizationId: ORG_A },
          toStatus: { organizationId: ORG_A },
        },
      }),
    );
  });

  it("returns an empty list without querying when the caller has no organization", async () => {
    actAs(undefined);

    const { status, body } = await parseResponse(await listWorkflow());

    expect(status).toBe(200);
    expect(body).toEqual([]);
    expect(mockPrisma.status_transitions.findMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/status-workflow", () => {
  const post = (body: Record<string, unknown>) =>
    createTransition(
      createMockRequest("/api/admin/status-workflow", {
        method: "POST",
        body,
      }),
    );

  it("creates a transition between two statuses of the caller's organization", async () => {
    const res = await post({ fromStatusId: A_USED, toStatusId: A_DONE });

    expect(res.status).toBe(201);
    expect(mockPrisma.status_transitions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatusId: A_USED,
          toStatusId: A_DONE,
        }),
      }),
    );
  });

  it("answers 400 when one status belongs to another organization", async () => {
    const res = await post({ fromStatusId: A_USED, toStatusId: B_USED });

    expect(res.status).toBe(400);
    expect(mockPrisma.status_transitions.create).not.toHaveBeenCalled();
  });

  it("answers 400 when both statuses belong to another organization", async () => {
    const res = await post({ fromStatusId: B_NEW, toStatusId: B_USED });

    expect(res.status).toBe(400);
    expect(mockPrisma.status_transitions.create).not.toHaveBeenCalled();
  });

  it("answers 400 for ids that are not plain strings", async () => {
    const res = await post({
      fromStatusId: { not: A_NEW },
      toStatusId: A_DONE,
    });

    expect(res.status).toBe(400);
    expect(mockPrisma.statusType.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.status_transitions.create).not.toHaveBeenCalled();
  });

  it("answers 403 when the caller has no organization", async () => {
    actAs(undefined);

    const res = await post({ fromStatusId: A_USED, toStatusId: A_DONE });

    expect(res.status).toBe(403);
    expect(mockPrisma.status_transitions.create).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/status-workflow", () => {
  const remove = (body: Record<string, unknown>) =>
    deleteTransition(
      createMockRequest("/api/admin/status-workflow", {
        method: "DELETE",
        body,
      }),
    );

  it("deletes a transition of the caller's organization", async () => {
    const res = await remove({ id: "t-a-1" });

    expect(res.status).toBe(200);
    expect(mockPrisma.status_transitions.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "t-a-1",
        fromStatus: { organizationId: ORG_A },
        toStatus: { organizationId: ORG_A },
      },
    });
  });

  it("answers 404 for a transition of another organization", async () => {
    transitions.push({
      id: "t-b-1",
      fromStatusId: B_NEW,
      toStatusId: B_USED,
    });

    const res = await remove({ id: "t-b-1" });

    expect(res.status).toBe(404);
    // The row must survive: the delete is scoped, never by id alone.
    expect(mockPrisma.status_transitions.delete).not.toHaveBeenCalled();
    expect(transitions.map((t) => t.id)).toContain("t-b-1");
  });

  it("answers 404 without writing when the caller has no organization", async () => {
    actAs(undefined);

    const res = await remove({ id: "t-a-1" });

    expect(res.status).toBe(404);
    expect(mockPrisma.status_transitions.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.status_transitions.delete).not.toHaveBeenCalled();
  });
});

describe("GET /api/status-transitions", () => {
  it("returns only the caller's organization's transition pairs", async () => {
    transitions.push({
      id: "t-b-1",
      fromStatusId: B_NEW,
      toStatusId: B_USED,
    });

    const { body } = await parseResponse<Array<Transition>>(
      await listTransitions(),
    );

    expect(mockPrisma.status_transitions.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          fromStatus: { organizationId: ORG_A },
          toStatus: { organizationId: ORG_A },
        },
      }),
    );
    expect(body.map((t) => t.fromStatusId)).toEqual([A_NEW]);
  });

  it("returns an empty list without querying when the caller has no organization", async () => {
    actAs(undefined);

    const { body } = await parseResponse(await listTransitions());

    expect(body).toEqual([]);
    expect(mockPrisma.status_transitions.findMany).not.toHaveBeenCalled();
  });
});

describe("PUT /api/asset/updateStatus", () => {
  const assets = [
    { assetid: "asset-a", statustypeid: A_NEW, organizationId: ORG_A },
    { assetid: "asset-a2", statustypeid: A_USED, organizationId: ORG_A },
    { assetid: "asset-b", statustypeid: B_NEW, organizationId: ORG_B },
  ];

  beforeEach(() => {
    mockPrisma.asset.findFirst.mockImplementation(
      (async (args: {
        where: { assetid: string; organizationId?: string | null };
      }) =>
        assets.find(
          (a) =>
            a.assetid === args.where.assetid &&
            a.organizationId === args.where.organizationId,
        ) ?? null) as never,
    );
    mockPrisma.asset.findUnique.mockImplementation(
      (async (args: { where: { assetid: string } }) =>
        assets.find((a) => a.assetid === args.where.assetid) ?? null) as never,
    );
    mockPrisma.asset.update.mockImplementation((async (args: {
      where: { assetid: string };
      data: { statustypeid: string };
    }) => ({
      ...assets.find((a) => a.assetid === args.where.assetid),
      ...args.data,
    })) as never);
  });

  const put = (body: Record<string, unknown>) =>
    updateStatus(
      createMockRequest("/api/asset/updateStatus", {
        method: "PUT",
        body,
      }) as never,
    );

  it("lets an organization without a workflow change status although another organization defined one", async () => {
    actAs(ORG_B);

    const res = await put({ assetId: "asset-b", statusTypeId: B_USED });

    expect(res.status).toBe(200);
    expect(mockPrisma.asset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statustypeid: B_USED }),
      }),
    );
    expect(mockPrisma.status_transitions.count).toHaveBeenCalledWith({
      where: {
        fromStatus: { organizationId: ORG_B },
        toStatus: { organizationId: ORG_B },
      },
    });
  });

  it("still enforces the caller's own workflow", async () => {
    const forbidden = await put({ assetId: "asset-a", statusTypeId: A_DONE });
    const allowed = await put({ assetId: "asset-a", statusTypeId: A_USED });

    expect(forbidden.status).toBe(400);
    expect(await forbidden.json()).toEqual({
      error: "This status transition is not allowed",
    });
    expect(allowed.status).toBe(200);
  });

  it("answers 400 for a status type of another organization", async () => {
    actAs(ORG_A);

    const res = await put({ assetId: "asset-a", statusTypeId: B_USED });

    expect(res.status).toBe(400);
    expect(mockPrisma.asset.update).not.toHaveBeenCalled();
  });

  it("resolves statusName inside the caller's organization", async () => {
    actAs(ORG_B);

    const res = await put({ assetId: "asset-b", statusName: "in use" });

    expect(res.status).toBe(200);
    expect(mockPrisma.statusType.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG_B }),
      }),
    );
    expect(mockPrisma.asset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statustypeid: B_USED }),
      }),
    );
  });

  it("answers 404 when statusName exists only in another organization", async () => {
    statuses.push({
      statustypeid: "status-b-only",
      statustypename: "Quarantine",
      organizationId: ORG_B,
    });
    try {
      const res = await put({ assetId: "asset-a", statusName: "quarantine" });

      expect(res.status).toBe(404);
      expect(mockPrisma.asset.update).not.toHaveBeenCalled();
    } finally {
      statuses.pop();
    }
  });

  it("answers 404 for an asset of another organization", async () => {
    const res = await put({ assetId: "asset-b", statusTypeId: A_USED });

    expect(res.status).toBe(404);
    expect(mockPrisma.asset.update).not.toHaveBeenCalled();
  });

  it("answers 404 without writing when the caller has no organization", async () => {
    actAs(undefined);

    const res = await put({ assetId: "asset-a", statusTypeId: A_USED });

    expect(res.status).toBe(404);
    expect(mockPrisma.statusType.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.asset.update).not.toHaveBeenCalled();
  });
});
