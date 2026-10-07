import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn(),
  AUDIT_ACTIONS: { UPDATE: "UPDATE", DELETE: "DELETE" },
  AUDIT_ENTITIES: { ASSET: "asset" },
}));

import { GET, POST } from "@/app/api/admin/workflows/route";
import {
  GET as GET_BY_ID,
  PUT,
  DELETE,
} from "@/app/api/admin/workflows/[id]/route";
import prisma from "@/lib/prisma";
import { requireApiAdmin, requireWritableOrg } from "@/lib/api-auth";

const mockPrisma = vi.mocked(prisma, true);

const OWN_ORG = "org-uuid-001";
const OTHER_ORG = "org-uuid-002";

const admin = {
  id: "admin-uuid-001",
  isAdmin: true,
  organizationId: OWN_ORG,
  orgStatus: "active" as const,
};

const ownRule = {
  id: "rule-own",
  name: "Own rule",
  trigger: "stock_low",
  conditions: "{}",
  actions: "[]",
  isActive: true,
  organizationId: OWN_ORG,
};

const foreignRule = {
  ...ownRule,
  id: "rule-foreign",
  name: "Foreign rule",
  organizationId: OTHER_ORG,
};

const rules = [ownRule, foreignRule];

type RuleWhere = { id?: string; organizationId?: string | null };

/**
 * In-memory stand-in with Prisma semantics: an `undefined` filter value
 * matches every row, so a missing organization can never narrow the query.
 */
function matches(rule: (typeof rules)[number], where: RuleWhere): boolean {
  return (
    (where.id === undefined || rule.id === where.id) &&
    (where.organizationId === undefined ||
      rule.organizationId === where.organizationId)
  );
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

const orgless = () =>
  vi.mocked(requireApiAdmin).mockResolvedValue({
    ...admin,
    organizationId: undefined,
  } as never);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireApiAdmin).mockResolvedValue(admin as never);
  vi.mocked(requireWritableOrg).mockResolvedValue(undefined);

  mockPrisma.automationRule.findMany.mockImplementation((async ({
    where,
  }: {
    where?: RuleWhere;
  }) => rules.filter((r) => matches(r, where ?? {}))) as never);
  mockPrisma.automationRule.findFirst.mockImplementation(
    (async ({ where }: { where: RuleWhere }) =>
      rules.find((r) => matches(r, where)) ?? null) as never,
  );
  // Unscoped lookup by primary key: a route that still uses it leaks rules
  // across organizations.
  mockPrisma.automationRule.findUnique.mockImplementation(
    (async ({ where }: { where: { id: string } }) =>
      rules.find((r) => r.id === where.id) ?? null) as never,
  );
  mockPrisma.automationRule.create.mockImplementation((async ({
    data,
  }: {
    data: Record<string, unknown>;
  }) => ({ id: "rule-new", ...data })) as never);
  mockPrisma.automationRule.update.mockImplementation((async ({
    data,
  }: {
    data: Record<string, unknown>;
  }) => ({ ...ownRule, ...data })) as never);
});

describe("GET /api/admin/workflows", () => {
  it("lists only the rules of the caller's organization", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(mockPrisma.automationRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: OWN_ORG }),
      }),
    );
    const body = (await res.json()) as Array<{ id: string }>;
    expect(body.map((r) => r.id)).toEqual(["rule-own"]);
  });

  it("returns an empty list without querying when the caller has no organization", async () => {
    orgless();

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(mockPrisma.automationRule.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/workflows/[id]", () => {
  it("returns a rule of the caller's organization", async () => {
    const res = await GET_BY_ID(
      createMockRequest("/api/admin/workflows/rule-own"),
      params("rule-own"),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.automationRule.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rule-own", organizationId: OWN_ORG },
      }),
    );
  });

  it("answers 404 for a rule of another organization", async () => {
    const res = await GET_BY_ID(
      createMockRequest("/api/admin/workflows/rule-foreign"),
      params("rule-foreign"),
    );

    expect(res.status).toBe(404);
  });

  it("answers 404 without querying when the caller has no organization", async () => {
    orgless();

    const res = await GET_BY_ID(
      createMockRequest("/api/admin/workflows/rule-own"),
      params("rule-own"),
    );

    expect(res.status).toBe(404);
    expect(mockPrisma.automationRule.findFirst).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/workflows", () => {
  // The shape WorkflowsPageClient sends: conditions as an object, actions as
  // an array, description null when empty.
  const uiBody = {
    name: "  Warranty alert  ",
    description: null,
    trigger: "warranty_expiring",
    conditions: { daysBeforeExpiry: 30 },
    actions: [{ type: "send_email", recipients: "ops@example.com" }],
    isActive: true,
  };

  const post = (body: Record<string, unknown>) =>
    POST(createMockRequest("/api/admin/workflows", { method: "POST", body }));

  it("stores the caller's organization on the new rule", async () => {
    const res = await post(uiBody);

    expect(res.status).toBe(201);
    expect(mockPrisma.automationRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: OWN_ORG,
          createdBy: "admin-uuid-001",
          name: "Warranty alert",
          trigger: "warranty_expiring",
          conditions: JSON.stringify({ daysBeforeExpiry: 30 }),
          actions: JSON.stringify(uiBody.actions),
        }),
      }),
    );
  });

  it("ignores an organizationId supplied in the body", async () => {
    await post({ ...uiBody, organizationId: OTHER_ORG });

    expect(mockPrisma.automationRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: OWN_ORG }),
      }),
    );
  });

  it("rejects an unknown trigger with 400", async () => {
    const res = await post({ ...uiBody, trigger: "drop_tables" });

    expect(res.status).toBe(400);
    expect(mockPrisma.automationRule.create).not.toHaveBeenCalled();
  });

  it("rejects a missing name with 400", async () => {
    const res = await post({ ...uiBody, name: "   " });

    expect(res.status).toBe(400);
    expect(mockPrisma.automationRule.create).not.toHaveBeenCalled();
  });

  it("rejects a rule name longer than the 200 character column with 400", async () => {
    const res = await post({ ...uiBody, name: "x".repeat(201) });

    expect(res.status).toBe(400);
    expect(mockPrisma.automationRule.create).not.toHaveBeenCalled();
  });

  it("accepts a rule name of exactly 200 characters", async () => {
    const res = await post({ ...uiBody, name: "x".repeat(200) });

    expect(res.status).toBe(201);
  });

  it("rejects the request when the caller has no organization", async () => {
    orgless();

    const res = await post(uiBody);

    expect(res.status).toBe(403);
    expect(mockPrisma.automationRule.create).not.toHaveBeenCalled();
  });
});

describe("PUT /api/admin/workflows/[id]", () => {
  const put = (id: string, body: Record<string, unknown>) =>
    PUT(
      createMockRequest(`/api/admin/workflows/${id}`, {
        method: "PUT",
        body,
      }),
      params(id),
    );

  it("updates a rule of the caller's organization after the scoped lookup", async () => {
    const res = await put("rule-own", { isActive: false });

    expect(res.status).toBe(200);
    expect(mockPrisma.automationRule.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rule-own", organizationId: OWN_ORG },
      }),
    );
    expect(mockPrisma.automationRule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rule-own" },
        data: { isActive: false },
      }),
    );
  });

  it("answers 404 and does not update a rule of another organization", async () => {
    const res = await put("rule-foreign", { name: "Hijacked" });

    expect(res.status).toBe(404);
    expect(mockPrisma.automationRule.update).not.toHaveBeenCalled();
  });

  it("does not let the body move a rule to another organization", async () => {
    await put("rule-own", { name: "Renamed", organizationId: OTHER_ORG });

    const call = mockPrisma.automationRule.update.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(call.data).not.toHaveProperty("organizationId");
  });

  it("rejects an invalid trigger with 400 and does not update", async () => {
    const res = await put("rule-own", { trigger: "drop_tables" });

    expect(res.status).toBe(400);
    expect(mockPrisma.automationRule.update).not.toHaveBeenCalled();
  });

  it("answers 404 without querying when the caller has no organization", async () => {
    orgless();

    const res = await put("rule-own", { isActive: false });

    expect(res.status).toBe(404);
    expect(mockPrisma.automationRule.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.automationRule.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/workflows/[id]", () => {
  const del = (id: string) =>
    DELETE(
      createMockRequest(`/api/admin/workflows/${id}`, { method: "DELETE" }),
      params(id),
    );

  it("deletes a rule of the caller's organization", async () => {
    const res = await del("rule-own");

    expect(res.status).toBe(200);
    expect(mockPrisma.automationRule.delete).toHaveBeenCalledWith({
      where: { id: "rule-own" },
    });
  });

  it("answers 404 and does not delete a rule of another organization", async () => {
    const res = await del("rule-foreign");

    expect(res.status).toBe(404);
    expect(mockPrisma.automationRule.delete).not.toHaveBeenCalled();
  });

  it("answers 404 without querying when the caller has no organization", async () => {
    orgless();

    const res = await del("rule-own");

    expect(res.status).toBe(404);
    expect(mockPrisma.automationRule.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.automationRule.delete).not.toHaveBeenCalled();
  });
});
