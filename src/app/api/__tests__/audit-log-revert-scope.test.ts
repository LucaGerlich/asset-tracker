import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseResponse } from "../../../../tests/setup/test-helpers";

/**
 * Reverting an audit-log entry (TECHNICAL_DEBT item 86) must only touch a
 * record of the caller's organization and must not write back a snapshot
 * that points at another tenant's rows.
 *
 * The route resolves its Prisma delegate by name (`name in prisma`), which the
 * Proxy automock cannot answer, so this file mocks a client keyed exactly like
 * the generated one (`component`, not `Component`).
 */

const model = () => ({
  findFirst: vi.fn().mockResolvedValue(null),
  findMany: vi.fn().mockResolvedValue([]),
  updateMany: vi.fn().mockResolvedValue({ count: 1 }),
});

const db = vi.hoisted(() => ({
  audit_logs: { findFirst: vi.fn() },
  asset: {} as ReturnType<typeof model>,
  component: {} as ReturnType<typeof model>,
  location: {} as ReturnType<typeof model>,
}));

vi.mock("@/lib/prisma", () => ({ default: db }));
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { POST as revert } from "@/app/api/admin/audit-logs/[id]/revert/route";

const CALLER_ORG = "org-uuid-001";
const ASSET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LOCATION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function logFor(entity: string, before: Record<string, unknown>) {
  db.audit_logs.findFirst.mockResolvedValue({
    id: "log-1",
    action: "UPDATE",
    entity,
    entityId: ASSET_ID,
    details: JSON.stringify({ before }),
  });
}

const callRevert = async () =>
  parseResponse(
    await revert(new Request("http://localhost:3000"), {
      params: Promise.resolve({ id: "log-1" }),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  db.asset = model();
  db.component = model();
  db.location = model();
});

describe("POST /api/admin/audit-logs/[id]/revert", () => {
  it("answers 404 when the target record belongs to another organization", async () => {
    logFor("asset", { assetname: "Old name" });

    const { status } = await callRevert();

    expect(status).toBe(404);
    expect(db.asset.findFirst).toHaveBeenCalledWith({
      where: { assetid: ASSET_ID, organizationId: CALLER_ORG },
    });
    expect(db.asset.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a snapshot that references another organization's location", async () => {
    logFor("asset", { assetname: "Old name", locationid: LOCATION_ID });
    db.asset.findFirst.mockResolvedValue({ assetid: ASSET_ID });
    db.location.findMany.mockResolvedValue([]);

    const { status, body } = await callRevert();

    expect(status).toBe(400);
    expect(body).toEqual({ error: "Location not found in your organization" });
    expect(db.asset.updateMany).not.toHaveBeenCalled();
  });

  it("writes an in-organization revert through the organization filter", async () => {
    logFor("asset", { assetname: "Old name", locationid: LOCATION_ID });
    db.asset.findFirst.mockResolvedValue({ assetid: ASSET_ID });
    db.location.findMany.mockResolvedValue([{ locationid: LOCATION_ID }]);

    const { status } = await callRevert();

    expect(status).toBe(200);
    expect(db.asset.updateMany).toHaveBeenCalledWith({
      where: { assetid: ASSET_ID, organizationId: CALLER_ORG },
      data: { assetname: "Old name", locationid: LOCATION_ID },
    });
  });

  it("resolves the component delegate instead of failing with 500", async () => {
    logFor("component", { name: "Old name" });
    db.component.findFirst.mockResolvedValue({ id: ASSET_ID });

    const { status } = await callRevert();

    expect(status).toBe(200);
    expect(db.component.updateMany).toHaveBeenCalledWith({
      where: { id: ASSET_ID, organizationId: CALLER_ORG },
      data: { name: "Old name" },
    });
  });
});
