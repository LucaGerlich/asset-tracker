import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

// organization-context (scopeToOrganization) pulls in the auth stack; the real
// scoping helper stays under test.
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn(),
  AUDIT_ACTIONS: { CREATE: "CREATE", UPDATE: "UPDATE", DELETE: "DELETE" },
}));
vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/integrations/slack-teams", () => ({
  notifyIntegrations: vi.fn().mockResolvedValue(undefined),
}));

import {
  GET as listAlerts,
  POST as createAlert,
  PUT as checkAlerts,
} from "@/app/api/stock-alerts/route";
import {
  DELETE as deleteAlert,
  GET as getAlert,
  PUT as updateAlert,
} from "@/app/api/stock-alerts/[id]/route";
import prisma from "@/lib/prisma";
import {
  requireApiAdmin,
  requireApiAuth,
  requireWritableOrg,
} from "@/lib/api-auth";
import { triggerWebhook } from "@/lib/webhooks";
import { ForbiddenError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);

const OWN_ORG = "org-uuid-001";
const OTHER_ORG = "other-org";
const OWN_CONSUMABLE_ID = "00000000-0000-4000-8000-0000000000a1";
const OTHER_CONSUMABLE_ID = "00000000-0000-4000-8000-0000000000b2";

const admin = {
  id: "admin-uuid-001",
  isAdmin: true,
  organizationId: OWN_ORG,
  orgStatus: "active" as const,
};

const ownAlert = {
  id: "alert-own",
  consumableId: OWN_CONSUMABLE_ID,
  minThreshold: 10,
  criticalThreshold: 5,
  emailNotify: true,
  webhookNotify: true,
  consumable: {
    consumableid: OWN_CONSUMABLE_ID,
    consumablename: "Toner",
    quantity: 2,
    minQuantity: 5,
    organizationId: OWN_ORG,
  },
};

const foreignAlert = {
  ...ownAlert,
  id: "alert-foreign",
  consumableId: OTHER_CONSUMABLE_ID,
  consumable: {
    ...ownAlert.consumable,
    consumableid: OTHER_CONSUMABLE_ID,
    consumablename: "Paper",
    organizationId: OTHER_ORG,
  },
};

interface ConsumableScope {
  organizationId?: string | null;
}

interface AlertWhere {
  id?: string;
  consumable?: ConsumableScope;
}

/** Minimal in-memory stand-in for the database: honours the org filter. */
function fakeAlertDatabase() {
  const all = [ownAlert, foreignAlert];
  // Like Prisma: an `undefined` filter value means "no filter at all".
  const inOrg = (scope: ConsumableScope | undefined, orgId: string | null) =>
    scope === undefined ||
    scope.organizationId === undefined ||
    scope.organizationId === orgId;

  mockPrisma.stockAlert.findFirst.mockImplementation(
    (async ({ where }: { where: AlertWhere }) =>
      all.find(
        (a) =>
          a.id === where.id &&
          inOrg(where.consumable, a.consumable.organizationId),
      ) ?? null) as never,
  );

  mockPrisma.stockAlert.findMany.mockImplementation((async ({
    where,
  }: {
    where?: AlertWhere;
  }) =>
    all.filter((a) =>
      inOrg(where?.consumable, a.consumable.organizationId),
    )) as never);

  mockPrisma.consumable.findFirst.mockImplementation(
    (async ({
      where,
    }: {
      where: { consumableid: string; organizationId?: string | null };
    }) =>
      all
        .map((a) => a.consumable)
        .find(
          (c) =>
            c.consumableid === where.consumableid &&
            (where.organizationId === undefined ||
              c.organizationId === where.organizationId),
        ) ?? null) as never,
  );

  mockPrisma.consumable.findUnique.mockImplementation(
    (async ({ where }: { where: { consumableid: string } }) =>
      all
        .map((a) => a.consumable)
        .find((c) => c.consumableid === where.consumableid) ?? null) as never,
  );

  mockPrisma.stockAlert.update.mockImplementation((async ({
    data,
  }: {
    data: Record<string, unknown>;
  }) => ({ ...ownAlert, ...data })) as never);
}

const idParams = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireApiAdmin).mockResolvedValue(admin as never);
  vi.mocked(requireApiAuth).mockResolvedValue(admin as never);
  vi.mocked(requireWritableOrg).mockResolvedValue(undefined);
  mockPrisma.stockAlert.findUnique.mockResolvedValue(null);
  fakeAlertDatabase();
});

describe("GET /api/stock-alerts", () => {
  it("lists only alerts of the caller's org", async () => {
    await listAlerts(createMockRequest("/api/stock-alerts"));

    expect(mockPrisma.stockAlert.findMany.mock.calls[0][0]?.where).toEqual({
      consumable: { organizationId: OWN_ORG },
    });
  });

  it("scopes an admin without an organization to unassigned consumables", async () => {
    vi.mocked(requireApiAuth).mockResolvedValue({
      ...admin,
      organizationId: undefined,
    } as never);

    await listAlerts(createMockRequest("/api/stock-alerts"));

    expect(mockPrisma.stockAlert.findMany.mock.calls[0][0]?.where).toEqual({
      consumable: { organizationId: null },
    });
  });
});

describe("GET /api/stock-alerts/[id]", () => {
  it("returns an alert of the caller's org", async () => {
    const res = await getAlert(
      createMockRequest("/api/stock-alerts/alert-own"),
      idParams("alert-own"),
    );
    expect(res.status).toBe(200);
  });

  it("answers 404 for an alert of another org", async () => {
    const res = await getAlert(
      createMockRequest("/api/stock-alerts/alert-foreign"),
      idParams("alert-foreign"),
    );
    expect(res.status).toBe(404);
  });

  it("never queries without an org filter for an admin without an organization", async () => {
    vi.mocked(requireApiAuth).mockResolvedValue({
      ...admin,
      organizationId: undefined,
    } as never);

    const res = await getAlert(
      createMockRequest("/api/stock-alerts/alert-own"),
      idParams("alert-own"),
    );

    expect(res.status).toBe(404);
    expect(mockPrisma.stockAlert.findFirst.mock.calls[0][0]?.where).toEqual({
      id: "alert-own",
      consumable: { organizationId: null },
    });
  });
});

describe("PUT /api/stock-alerts/[id]", () => {
  const put = (id: string, body: Record<string, unknown>) =>
    updateAlert(
      createMockRequest(`/api/stock-alerts/${id}`, { method: "PUT", body }),
      idParams(id),
    );

  it("answers 404 and updates nothing for an alert of another org", async () => {
    const res = await put("alert-foreign", { minThreshold: 50 });

    expect(res.status).toBe(404);
    expect(mockPrisma.stockAlert.update).not.toHaveBeenCalled();
  });

  it("writes only the fields that were sent", async () => {
    const res = await put("alert-own", { minThreshold: 20 });

    expect(res.status).toBe(200);
    expect(mockPrisma.stockAlert.update.mock.calls[0][0].data).toEqual({
      minThreshold: 20,
      updatedAt: expect.any(Date),
    });
  });

  it("returns 403 and updates nothing when the org is read-only", async () => {
    vi.mocked(requireWritableOrg).mockRejectedValue(
      new ForbiddenError("org_read_only", "Organization is in read-only mode"),
    );

    const res = await put("alert-own", { minThreshold: 20 });

    expect(res.status).toBe(403);
    expect(mockPrisma.stockAlert.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/stock-alerts/[id]", () => {
  const remove = (id: string) =>
    deleteAlert(
      createMockRequest(`/api/stock-alerts/${id}`, { method: "DELETE" }),
      idParams(id),
    );

  it("answers 404 and deletes nothing for an alert of another org", async () => {
    const res = await remove("alert-foreign");

    expect(res.status).toBe(404);
    expect(mockPrisma.stockAlert.delete).not.toHaveBeenCalled();
  });

  it("deletes an alert of the caller's org", async () => {
    const res = await remove("alert-own");

    expect(res.status).toBe(200);
    expect(mockPrisma.stockAlert.delete).toHaveBeenCalledWith({
      where: { id: "alert-own" },
    });
  });
});

describe("POST /api/stock-alerts", () => {
  const post = (consumableId: string) =>
    createAlert(
      createMockRequest("/api/stock-alerts", {
        method: "POST",
        body: { consumableId },
      }),
    );

  it("rejects a consumable of another org and creates nothing", async () => {
    const res = await post(OTHER_CONSUMABLE_ID);
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
    expect(mockPrisma.stockAlert.create).not.toHaveBeenCalled();
  });

  it("creates an alert for a consumable of the caller's org", async () => {
    mockPrisma.stockAlert.create.mockResolvedValue(ownAlert as never);

    const res = await post(OWN_CONSUMABLE_ID);

    expect(res.status).toBe(201);
    expect(mockPrisma.consumable.findFirst.mock.calls[0][0]?.where).toEqual({
      consumableid: OWN_CONSUMABLE_ID,
      organizationId: OWN_ORG,
    });
    expect(mockPrisma.stockAlert.create).toHaveBeenCalledTimes(1);
  });
});

describe("PUT /api/stock-alerts (threshold check)", () => {
  it("only checks, updates and notifies for the caller's org", async () => {
    const res = await checkAlerts();
    const { status, body } = await parseResponse<{
      checked: number;
      triggered: number;
    }>(res);

    expect(status).toBe(200);
    expect(mockPrisma.stockAlert.findMany.mock.calls[0][0]?.where).toEqual({
      consumable: { organizationId: OWN_ORG },
    });
    expect(body).toMatchObject({ checked: 1, triggered: 1 });
    expect(mockPrisma.stockAlert.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.stockAlert.update.mock.calls[0][0].where).toEqual({
      id: "alert-own",
    });
    expect(triggerWebhook).toHaveBeenCalledTimes(1);
    expect(vi.mocked(triggerWebhook).mock.calls[0][2]).toBe(OWN_ORG);
  });
});
