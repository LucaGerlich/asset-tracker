import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/email", () => ({ queueEmail: vi.fn() }));
vi.mock("@/lib/org-suspension", () => ({ getOrgSuspensionStatus: vi.fn() }));
vi.mock("@/lib/webhooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/webhooks")>()),
  triggerWebhook: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { queueEmail } from "@/lib/email";
import { getOrgSuspensionStatus, type OrgStatus } from "@/lib/org-suspension";
import { triggerWebhook } from "@/lib/webhooks";
import {
  processWorkflowTrigger,
  runScheduledWorkflows,
} from "@/lib/workflow-engine";

const mockPrisma = vi.mocked(prisma, true);
const mockStatus = vi.mocked(getOrgSuspensionStatus);
const mockQueueEmail = vi.mocked(queueEmail);
const mockTriggerWebhook = vi.mocked(triggerWebhook);

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ASSET_ID = "11111111-1111-4111-8111-111111111111";
const STATUS_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";

const NOT_ALLOWED = "Action not allowed for this organization";

interface RuleOptions {
  id?: string;
  name?: string;
  conditions?: string;
  runCount?: number;
}

function rule(actions: unknown, options: RuleOptions = {}) {
  return {
    id: options.id ?? "rule-1",
    name: options.name ?? "Test rule",
    conditions: options.conditions ?? "[]",
    actions: JSON.stringify(actions),
    runCount: options.runCount ?? 3,
  };
}

function givenRules(...rules: ReturnType<typeof rule>[]) {
  mockPrisma.automationRule.findMany.mockResolvedValue(rules as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStatus.mockResolvedValue("active");
  mockPrisma.automationRule.findMany.mockResolvedValue([]);
  mockPrisma.asset.findMany.mockResolvedValue([]);
  mockPrisma.maintenance_schedules.findMany.mockResolvedValue([]);
  mockPrisma.licence.findMany.mockResolvedValue([]);
  mockPrisma.consumable.findMany.mockResolvedValue([]);
  mockPrisma.asset.findFirst.mockResolvedValue(null);
  mockPrisma.statusType.findFirst.mockResolvedValue(null);
  mockPrisma.user.findFirst.mockResolvedValue(null);
});

describe("processWorkflowTrigger rule selection", () => {
  it("only loads the active rules of the given organization", async () => {
    await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

    expect(mockPrisma.automationRule.findMany).toHaveBeenCalledWith({
      where: {
        trigger: "warranty_expiring",
        isActive: true,
        organizationId: ORG_A,
      },
    });
  });

  it("refuses to run without an organization instead of loading every org's rules", async () => {
    const result = await processWorkflowTrigger(
      "warranty_expiring",
      {},
      undefined as unknown as string,
    );

    expect(mockPrisma.automationRule.findMany).not.toHaveBeenCalled();
    expect(result.executed).toBe(0);
    expect(result.errors).toHaveLength(1);
  });

  it("runs no rules for a locked-out organization", async () => {
    mockStatus.mockResolvedValue("locked_out");
    givenRules(rule([{ type: "send_email", config: {} }]));

    const result = await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

    expect(mockStatus).toHaveBeenCalledWith(ORG_A);
    expect(mockPrisma.automationRule.findMany).not.toHaveBeenCalled();
    expect(mockQueueEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ executed: 0, errors: [] });
  });

  it("still runs the rules of a read-only organization", async () => {
    mockStatus.mockResolvedValue("read_only");
    givenRules(rule([]));

    const result = await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

    expect(result.executed).toBe(1);
  });

  it("looks the status up once per organization when a cache is shared", async () => {
    const cache = new Map<string, OrgStatus>();

    await processWorkflowTrigger("stock_low", {}, ORG_A, cache);
    await processWorkflowTrigger("stock_low", {}, ORG_A, cache);
    await processWorkflowTrigger("stock_low", {}, ORG_B, cache);

    expect(mockStatus).toHaveBeenCalledTimes(2);
    expect(mockStatus).toHaveBeenNthCalledWith(1, ORG_A);
    expect(mockStatus).toHaveBeenNthCalledWith(2, ORG_B);
  });

  it("increments the run count atomically", async () => {
    givenRules(rule([], { id: "rule-9", runCount: 41 }));

    await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

    const call = mockPrisma.automationRule.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "rule-9" });
    expect(call.data.runCount).toEqual({ increment: 1 });
    expect(call.data.lastRunAt).toBeInstanceOf(Date);
  });

  it("records a failing rule and keeps running the others", async () => {
    givenRules(
      rule(
        [
          {
            type: "update_status",
            config: { assetId: ASSET_ID, statusId: STATUS_ID },
          },
        ],
        {
          id: "rule-bad",
          name: "Bad rule",
        },
      ),
      rule([], { id: "rule-good", name: "Good rule" }),
    );

    const result = await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

    expect(result.executed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("rule-bad");
    expect(result.errors[0]).toContain(NOT_ALLOWED);
    expect(mockPrisma.automationRule.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.automationRule.update.mock.calls[0][0].where).toEqual({
      id: "rule-good",
    });
  });

  it("keeps recording a rule whose conditions cannot be evaluated", async () => {
    givenRules(rule([], { conditions: "{}" }));

    const result = await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

    expect(result.executed).toBe(0);
    expect(result.errors).toHaveLength(1);
  });
});

describe("update_status action", () => {
  const action = {
    type: "update_status",
    config: { assetId: ASSET_ID, statusId: STATUS_ID },
  };

  it("updates an asset and status of the organization, scoped by organization", async () => {
    mockPrisma.asset.findFirst.mockResolvedValue({
      assetid: ASSET_ID,
    } as never);
    mockPrisma.statusType.findFirst.mockResolvedValue({
      statustypeid: STATUS_ID,
    } as never);
    givenRules(rule([action]));

    const result = await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

    expect(result).toEqual({ executed: 1, errors: [] });
    expect(mockPrisma.asset.findFirst).toHaveBeenCalledWith({
      where: { assetid: ASSET_ID, organizationId: ORG_A },
    });
    expect(mockPrisma.statusType.findFirst).toHaveBeenCalledWith({
      where: { statustypeid: STATUS_ID, organizationId: ORG_A },
    });
    expect(mockPrisma.asset.updateMany).toHaveBeenCalledTimes(1);
    const call = mockPrisma.asset.updateMany.mock.calls[0][0];
    expect(call?.where).toEqual({ assetid: ASSET_ID, organizationId: ORG_A });
    expect(call?.data).toMatchObject({ statustypeid: STATUS_ID });
    expect(mockPrisma.asset.update).not.toHaveBeenCalled();
  });

  it("falls back to the assetId of the trigger data", async () => {
    mockPrisma.asset.findFirst.mockResolvedValue({
      assetid: ASSET_ID,
    } as never);
    mockPrisma.statusType.findFirst.mockResolvedValue({
      statustypeid: STATUS_ID,
    } as never);
    givenRules(
      rule([{ type: "update_status", config: { statusId: STATUS_ID } }]),
    );

    await processWorkflowTrigger(
      "warranty_expiring",
      { assetId: ASSET_ID },
      ORG_A,
    );

    expect(mockPrisma.asset.updateMany).toHaveBeenCalledTimes(1);
  });

  it("records an error and does not update another organization's asset", async () => {
    mockPrisma.asset.findFirst.mockResolvedValue(null);
    mockPrisma.statusType.findFirst.mockResolvedValue({
      statustypeid: STATUS_ID,
    } as never);
    givenRules(rule([action]));

    const result = await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

    expect(result.executed).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain(NOT_ALLOWED);
    expect(mockPrisma.asset.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.automationRule.update).not.toHaveBeenCalled();
  });

  it("records an error and does not apply another organization's status", async () => {
    mockPrisma.asset.findFirst.mockResolvedValue({
      assetid: ASSET_ID,
    } as never);
    mockPrisma.statusType.findFirst.mockResolvedValue(null);
    givenRules(rule([action]));

    const result = await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

    expect(result.executed).toBe(0);
    expect(result.errors[0]).toContain(NOT_ALLOWED);
    expect(mockPrisma.asset.updateMany).not.toHaveBeenCalled();
  });

  it("ignores ids that are not plain strings instead of widening the query", async () => {
    givenRules(
      rule([
        {
          type: "update_status",
          config: { assetId: { not: "x" }, statusId: STATUS_ID },
        },
      ]),
    );

    await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

    expect(mockPrisma.asset.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.asset.updateMany).not.toHaveBeenCalled();
  });
});

describe("trigger_webhook action", () => {
  it("records an error for an unknown event and delivers nothing", async () => {
    givenRules(
      rule([
        { type: "trigger_webhook", config: { event: "not.a.real.event" } },
      ]),
    );

    const result = await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

    expect(result.executed).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(mockTriggerWebhook).not.toHaveBeenCalled();
  });

  it("does not accept inherited object keys as events", async () => {
    givenRules(
      rule([{ type: "trigger_webhook", config: { event: "constructor" } }]),
    );

    const result = await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

    expect(result.errors).toHaveLength(1);
    expect(mockTriggerWebhook).not.toHaveBeenCalled();
  });

  it("delivers a known event scoped to the organization", async () => {
    givenRules(
      rule([
        { type: "trigger_webhook", config: { event: "license.expiring" } },
      ]),
    );
    const data = { licenseId: "l1" };

    const result = await processWorkflowTrigger(
      "license_expiring",
      data,
      ORG_A,
    );

    expect(result).toEqual({ executed: 1, errors: [] });
    expect(mockTriggerWebhook).toHaveBeenCalledWith(
      "license.expiring",
      data,
      ORG_A,
    );
  });
});

describe("send_notification action", () => {
  const action = {
    type: "send_notification",
    config: { userId: USER_ID, message: "Warranty of {{assetName}} ends" },
  };

  it("queues a mail to a user of the organization", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      userid: USER_ID,
      email: "member@example.com",
    } as never);
    givenRules(rule([action]));

    const result = await processWorkflowTrigger(
      "warranty_expiring",
      { assetName: "Laptop" },
      ORG_A,
    );

    expect(result).toEqual({ executed: 1, errors: [] });
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userid: USER_ID, organizationId: ORG_A },
      }),
    );
    expect(mockQueueEmail).toHaveBeenCalledWith(
      USER_ID,
      "workflow_notification",
      "member@example.com",
      "Workflow Notification",
      "Warranty of Laptop ends",
    );
  });

  it("records an error and sends nothing to a user of another organization", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    givenRules(rule([action]));

    const result = await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

    expect(result.executed).toBe(0);
    expect(result.errors[0]).toContain(NOT_ALLOWED);
    expect(mockQueueEmail).not.toHaveBeenCalled();
  });

  it("does not look up a user without a plain string id", async () => {
    givenRules(rule([{ type: "send_notification", config: { message: "x" } }]));

    const result = await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

    expect(result.errors[0]).toContain(NOT_ALLOWED);
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    expect(mockQueueEmail).not.toHaveBeenCalled();
  });
});

describe("create_ticket action", () => {
  const action = {
    type: "create_ticket",
    config: { title: "Renew {{assetName}}", createdBy: USER_ID },
  };

  it("creates a ticket for a creator in the organization", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ userid: USER_ID } as never);
    givenRules(rule([action]));

    const result = await processWorkflowTrigger(
      "warranty_expiring",
      { assetName: "Laptop" },
      ORG_A,
    );

    expect(result).toEqual({ executed: 1, errors: [] });
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userid: USER_ID, organizationId: ORG_A },
      }),
    );
    expect(mockPrisma.tickets.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.tickets.create.mock.calls[0][0].data).toMatchObject({
      title: "Renew Laptop",
      createdBy: USER_ID,
    });
  });

  it("records an error and creates no ticket for a creator of another organization", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    givenRules(rule([action]));

    const result = await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

    expect(result.executed).toBe(0);
    expect(result.errors[0]).toContain(NOT_ALLOWED);
    expect(mockPrisma.tickets.create).not.toHaveBeenCalled();
  });

  it("skips quietly when no creator is configured", async () => {
    givenRules(rule([{ type: "create_ticket", config: { title: "T" } }]));

    const result = await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

    expect(result).toEqual({ executed: 1, errors: [] });
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.tickets.create).not.toHaveBeenCalled();
  });
});

describe("send_email action", () => {
  it("queues a mail to a valid address", async () => {
    givenRules(
      rule([
        {
          type: "send_email",
          config: {
            to: "ops@example.com",
            subject: "Expiring: {{assetName}}",
            body: "Check it",
          },
        },
      ]),
    );

    const result = await processWorkflowTrigger(
      "warranty_expiring",
      { assetName: "Laptop" },
      ORG_A,
    );

    expect(result).toEqual({ executed: 1, errors: [] });
    expect(mockQueueEmail).toHaveBeenCalledWith(
      null,
      "workflow",
      "ops@example.com",
      "Expiring: Laptop",
      "Check it",
    );
  });

  it("validates the recipient after templating", async () => {
    givenRules(
      rule([
        {
          type: "send_email",
          config: { to: "{{ownerEmail}}", subject: "s", body: "b" },
        },
      ]),
    );

    const result = await processWorkflowTrigger(
      "warranty_expiring",
      { ownerEmail: "owner@example.com" },
      ORG_A,
    );

    expect(result.errors).toEqual([]);
    expect(mockQueueEmail.mock.calls[0][2]).toBe("owner@example.com");
  });

  it.each([
    ["a missing address", undefined],
    ["a plain string", "not-an-email"],
    ["a header-injection attempt", "a@example.com\nbcc: b@example.com"],
  ])("records an error for %s and queues nothing", async (_label, to) => {
    givenRules(
      rule([{ type: "send_email", config: { to, subject: "s", body: "b" } }]),
    );

    const result = await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

    expect(result.executed).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(mockQueueEmail).not.toHaveBeenCalled();
  });
});

describe("runScheduledWorkflows", () => {
  function ruleScopes() {
    return mockPrisma.automationRule.findMany.mock.calls.map(
      ([args]) => args?.where,
    );
  }

  it("passes the organization of each expiring asset and skips rows without one", async () => {
    mockPrisma.asset.findMany.mockResolvedValue([
      {
        assetid: "a1",
        assetname: "A1",
        assettag: "T1",
        warrantyExpires: null,
        organizationId: ORG_A,
      },
      {
        assetid: "a2",
        assetname: "A2",
        assettag: "T2",
        warrantyExpires: null,
        organizationId: null,
      },
      {
        assetid: "a3",
        assetname: "A3",
        assettag: "T3",
        warrantyExpires: null,
        organizationId: ORG_B,
      },
    ] as never);

    const results = await runScheduledWorkflows();

    expect(ruleScopes()).toEqual([
      { trigger: "warranty_expiring", isActive: true, organizationId: ORG_A },
      { trigger: "warranty_expiring", isActive: true, organizationId: ORG_B },
    ]);
    expect(results.map((r) => r.trigger)).toEqual([
      "warranty_expiring",
      "warranty_expiring",
    ]);
    expect(mockPrisma.asset.findMany.mock.calls[0][0]?.select).toMatchObject({
      organizationId: true,
    });
  });

  it("uses the organization of the asset for due maintenance", async () => {
    mockPrisma.maintenance_schedules.findMany.mockResolvedValue([
      {
        id: "m1",
        title: "Service",
        assetId: "a1",
        nextDueDate: new Date("2026-10-10"),
        asset: { assetname: "A1", organizationId: ORG_A },
      },
      {
        id: "m2",
        title: "Orphan",
        assetId: "a2",
        nextDueDate: new Date("2026-10-10"),
        asset: { assetname: "A2", organizationId: null },
      },
    ] as never);

    await runScheduledWorkflows();

    expect(ruleScopes()).toEqual([
      { trigger: "maintenance_due", isActive: true, organizationId: ORG_A },
    ]);
  });

  it("passes the organization of each expiring licence and skips rows without one", async () => {
    mockPrisma.licence.findMany.mockResolvedValue([
      {
        licenceid: "l1",
        licencekey: "K1",
        expirationdate: null,
        organizationId: ORG_B,
        licenceCategoryType: { licencecategorytypename: "Office" },
      },
      {
        licenceid: "l2",
        licencekey: "K2",
        expirationdate: null,
        organizationId: null,
        licenceCategoryType: { licencecategorytypename: "Office" },
      },
    ] as never);

    await runScheduledWorkflows();

    expect(ruleScopes()).toEqual([
      { trigger: "license_expiring", isActive: true, organizationId: ORG_B },
    ]);
    expect(mockPrisma.licence.findMany.mock.calls[0][0]?.select).toMatchObject({
      organizationId: true,
    });
  });

  it("passes the organization of each low-stock consumable and skips rows without one", async () => {
    mockPrisma.consumable.findMany.mockResolvedValue([
      {
        consumableid: "c1",
        consumablename: "Toner",
        quantity: 1,
        minQuantity: 5,
        organizationId: ORG_A,
      },
      {
        consumableid: "c2",
        consumablename: "Paper",
        quantity: 9,
        minQuantity: 5,
        organizationId: ORG_A,
      },
      {
        consumableid: "c3",
        consumablename: "Ink",
        quantity: 0,
        minQuantity: 2,
        organizationId: null,
      },
    ] as never);

    await runScheduledWorkflows();

    expect(ruleScopes()).toEqual([
      { trigger: "stock_low", isActive: true, organizationId: ORG_A },
    ]);
    expect(
      mockPrisma.consumable.findMany.mock.calls[0][0]?.select,
    ).toMatchObject({
      organizationId: true,
    });
  });

  it("looks up each organization's status once per run", async () => {
    mockPrisma.asset.findMany.mockResolvedValue([
      {
        assetid: "a1",
        assetname: "A1",
        assettag: "T1",
        warrantyExpires: null,
        organizationId: ORG_A,
      },
      {
        assetid: "a2",
        assetname: "A2",
        assettag: "T2",
        warrantyExpires: null,
        organizationId: ORG_A,
      },
    ] as never);
    mockPrisma.consumable.findMany.mockResolvedValue([
      {
        consumableid: "c1",
        consumablename: "Toner",
        quantity: 1,
        minQuantity: 5,
        organizationId: ORG_A,
      },
    ] as never);

    await runScheduledWorkflows();

    expect(mockStatus).toHaveBeenCalledTimes(1);
    expect(mockStatus).toHaveBeenCalledWith(ORG_A);
  });

  it("runs nothing for a locked-out organization", async () => {
    mockStatus.mockResolvedValue("locked_out");
    mockPrisma.asset.findMany.mockResolvedValue([
      {
        assetid: "a1",
        assetname: "A1",
        assettag: "T1",
        warrantyExpires: null,
        organizationId: ORG_A,
      },
    ] as never);

    await runScheduledWorkflows();

    expect(mockPrisma.automationRule.findMany).not.toHaveBeenCalled();
  });
});
