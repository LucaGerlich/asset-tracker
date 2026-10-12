import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

// Callers without an organization own nothing: every route below must answer
// 404 / empty without touching a tenant table, instead of dropping its
// organization filter and reaching every tenant's rows.

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn(),
  AUDIT_ACTIONS: { UPDATE: "UPDATE" },
}));
vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/integrations/slack-teams", () => ({
  notifyIntegrations: vi.fn().mockResolvedValue(undefined),
}));

const storage = vi.hoisted(() => ({
  provider: { delete: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("@/lib/storage", () => ({
  getStorage: vi.fn(async () => storage.provider),
  getOrgStorage: vi.fn(async () => storage.provider),
}));
vi.mock("@/lib/storage/thumbnails", () => ({
  deleteThumbnails: vi.fn().mockResolvedValue(undefined),
}));

import { GET as listAuditLogs } from "@/app/api/admin/audit-logs/route";
import { POST as revertAuditLog } from "@/app/api/admin/audit-logs/[id]/revert/route";
import {
  DELETE as deleteAttachment,
  PATCH as patchAttachment,
} from "@/app/api/asset/attachments/[id]/route";
import {
  GET as getSchedule,
  PUT as putSchedule,
  DELETE as deleteSchedule,
} from "@/app/api/maintenance/[id]/route";
import {
  GET as listSchedules,
  POST as createSchedule,
} from "@/app/api/maintenance/route";
import { GET as listUserAssets } from "@/app/api/userAssets/route";
import { GET as listUserAccessoires } from "@/app/api/userAccessoires/route";
import { GET as listRequests } from "@/app/api/requests/route";
import { GET as validateUser } from "@/app/api/user/validate/route";
import prisma from "@/lib/prisma";
import {
  requireApiAdmin,
  requireApiAuth,
  requirePermission,
} from "@/lib/api-auth";

const mockPrisma = vi.mocked(prisma, true);

const OWN_ORG = "org-uuid-001";
const SCHEDULE_ID = "00000000-0000-4000-8000-0000000000a1";

const actAs = (organizationId: string | undefined, isAdmin = true) => {
  const user = {
    id: "admin-uuid-001",
    isAdmin,
    organizationId,
    orgStatus: "active" as const,
  } as never;
  vi.mocked(requireApiAuth).mockResolvedValue(user);
  vi.mocked(requireApiAdmin).mockResolvedValue(user);
  vi.mocked(requirePermission).mockResolvedValue(user);
};

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  actAs(undefined);
});

describe("org-less callers: reads answer empty without querying", () => {
  it("GET /api/admin/audit-logs", async () => {
    const { status, body } = await parseResponse<{ data: unknown[] }>(
      await listAuditLogs(createMockRequest("/api/admin/audit-logs")),
    );

    expect(status).toBe(200);
    expect(body.data).toEqual([]);
    expect(mockPrisma.audit_logs.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.audit_logs.count).not.toHaveBeenCalled();
  });

  it("GET /api/maintenance", async () => {
    const plain = await parseResponse(
      await listSchedules(createMockRequest("/api/maintenance") as never),
    );
    const paged = await parseResponse<{ data: unknown[] }>(
      await listSchedules(
        createMockRequest("/api/maintenance?page=1") as never,
      ),
    );

    expect(plain.body).toEqual([]);
    expect(paged.body.data).toEqual([]);
    expect(mockPrisma.maintenance_schedules.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.maintenance_schedules.count).not.toHaveBeenCalled();
  });

  it("GET /api/maintenance/[id]", async () => {
    const res = await getSchedule(
      createMockRequest(`/api/maintenance/${SCHEDULE_ID}`) as never,
      params(SCHEDULE_ID),
    );

    expect(res.status).toBe(404);
    expect(mockPrisma.maintenance_schedules.findFirst).not.toHaveBeenCalled();
  });

  it("GET /api/userAssets", async () => {
    const { body } = await parseResponse(await listUserAssets());

    expect(body).toEqual([]);
    expect(mockPrisma.userAssets.findMany).not.toHaveBeenCalled();
  });

  it("GET /api/userAccessoires", async () => {
    const { body } = await parseResponse(
      await listUserAccessoires(
        createMockRequest("/api/userAccessoires") as never,
      ),
    );

    expect(body).toEqual([]);
    expect(mockPrisma.userAccessoires.findMany).not.toHaveBeenCalled();
  });

  it("GET /api/requests", async () => {
    const { body } = await parseResponse(
      await listRequests(createMockRequest("/api/requests") as never),
    );

    expect(body).toEqual([]);
    expect(mockPrisma.itemRequest.findMany).not.toHaveBeenCalled();
  });

  it("GET /api/user/validate (no account-existence oracle)", async () => {
    const { body } = await parseResponse(
      await validateUser(
        createMockRequest(
          "/api/user/validate?username=root&email=a@b.c",
        ) as never,
      ),
    );

    expect(body).toEqual({});
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
  });
});

describe("org-less callers: writes answer 404 without writing", () => {
  it("POST /api/admin/audit-logs/[id]/revert", async () => {
    const res = await revertAuditLog(
      createMockRequest("/api/admin/audit-logs/x/revert", {
        method: "POST",
      }),
      params("log-1"),
    );

    expect(res.status).toBe(404);
    expect(mockPrisma.audit_logs.findFirst).not.toHaveBeenCalled();
  });

  it("DELETE /api/asset/attachments/[id]", async () => {
    const res = await deleteAttachment(
      createMockRequest("/api/asset/attachments/a-1", {
        method: "DELETE",
      }) as never,
      params("a-1"),
    );

    expect(res.status).toBe(404);
    expect(mockPrisma.asset_attachments.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.asset_attachments.delete).not.toHaveBeenCalled();
    expect(storage.provider.delete).not.toHaveBeenCalled();
  });

  it("PATCH /api/asset/attachments/[id]", async () => {
    const res = await patchAttachment(
      createMockRequest("/api/asset/attachments/a-1", {
        method: "PATCH",
        body: { isPrimary: true },
      }) as never,
      params("a-1"),
    );

    expect(res.status).toBe(404);
    expect(mockPrisma.asset_attachments.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.asset_attachments.update).not.toHaveBeenCalled();
    expect(mockPrisma.asset_attachments.updateMany).not.toHaveBeenCalled();
  });

  it("PUT /api/maintenance/[id]", async () => {
    const res = await putSchedule(
      createMockRequest(`/api/maintenance/${SCHEDULE_ID}`, {
        method: "PUT",
        body: { title: "x" },
      }) as never,
      params(SCHEDULE_ID),
    );

    expect(res.status).toBe(404);
    expect(mockPrisma.maintenance_schedules.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.maintenance_schedules.update).not.toHaveBeenCalled();
  });

  it("DELETE /api/maintenance/[id]", async () => {
    const res = await deleteSchedule(
      createMockRequest(`/api/maintenance/${SCHEDULE_ID}`, {
        method: "DELETE",
      }) as never,
      params(SCHEDULE_ID),
    );

    expect(res.status).toBe(404);
    expect(mockPrisma.maintenance_schedules.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.maintenance_schedules.delete).not.toHaveBeenCalled();
  });

  it("POST /api/maintenance", async () => {
    const res = await createSchedule(
      createMockRequest("/api/maintenance", {
        method: "POST",
        body: {
          title: "Service",
          assetId: "asset-1",
          frequency: "monthly",
          nextDueDate: "2026-12-01",
        },
      }) as never,
    );

    expect(res.status).toBe(404);
    expect(mockPrisma.asset.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.maintenance_schedules.create).not.toHaveBeenCalled();
  });
});

describe("callers with an organization stay scoped to it", () => {
  beforeEach(() => actAs(OWN_ORG));

  it("lists audit logs of the organization's users only", async () => {
    await listAuditLogs(createMockRequest("/api/admin/audit-logs"));

    expect(mockPrisma.audit_logs.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ user: { organizationId: OWN_ORG } }),
      }),
    );
  });

  it("looks the audit log up through its user's organization before reverting", async () => {
    const res = await revertAuditLog(
      createMockRequest("/api/admin/audit-logs/x/revert", {
        method: "POST",
      }),
      params("log-1"),
    );

    expect(res.status).toBe(404);
    expect(mockPrisma.audit_logs.findFirst).toHaveBeenCalledWith({
      where: { id: "log-1", user: { organizationId: OWN_ORG } },
    });
  });

  it("scopes attachment deletes and patches through the asset", async () => {
    await deleteAttachment(
      createMockRequest("/api/asset/attachments/a-1", {
        method: "DELETE",
      }) as never,
      params("a-1"),
    );
    await patchAttachment(
      createMockRequest("/api/asset/attachments/a-1", {
        method: "PATCH",
        body: { isPrimary: true },
      }) as never,
      params("a-1"),
    );

    expect(mockPrisma.asset_attachments.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: "a-1", asset: { organizationId: OWN_ORG } },
    });
    expect(mockPrisma.asset_attachments.findFirst).toHaveBeenNthCalledWith(2, {
      where: { id: "a-1", asset: { organizationId: OWN_ORG } },
    });
  });

  it("scopes the maintenance schedule lookups through the asset", async () => {
    await getSchedule(
      createMockRequest(`/api/maintenance/${SCHEDULE_ID}`) as never,
      params(SCHEDULE_ID),
    );
    await deleteSchedule(
      createMockRequest(`/api/maintenance/${SCHEDULE_ID}`, {
        method: "DELETE",
      }) as never,
      params(SCHEDULE_ID),
    );

    for (const call of mockPrisma.maintenance_schedules.findFirst.mock.calls) {
      expect(call[0]?.where).toEqual({
        id: SCHEDULE_ID,
        asset: { organizationId: OWN_ORG },
      });
    }
    expect(mockPrisma.maintenance_schedules.findFirst).toHaveBeenCalledTimes(2);
  });

  it("scopes the maintenance list, user assets, accessories and requests", async () => {
    await listSchedules(createMockRequest("/api/maintenance") as never);
    await listUserAssets();
    await listUserAccessoires(
      createMockRequest("/api/userAccessoires") as never,
    );
    await listRequests(createMockRequest("/api/requests") as never);

    expect(mockPrisma.maintenance_schedules.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { asset: { organizationId: OWN_ORG } },
      }),
    );
    expect(mockPrisma.userAssets.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { asset: { organizationId: OWN_ORG } },
      }),
    );
    expect(mockPrisma.userAccessoires.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accessories: { organizationId: OWN_ORG } },
      }),
    );
    expect(mockPrisma.itemRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user: { organizationId: OWN_ORG } },
      }),
    );
  });

  it("validates usernames and emails inside the organization", async () => {
    await validateUser(
      createMockRequest(
        "/api/user/validate?username=root&email=a@b.c",
      ) as never,
    );

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: { username: "root", organizationId: OWN_ORG },
    });
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: "a@b.c", organizationId: OWN_ORG },
    });
  });

  it("rejects an assignee from another organization on create and update", async () => {
    mockPrisma.asset.findFirst.mockResolvedValue({
      assetid: "asset-1",
    } as never);
    mockPrisma.maintenance_schedules.findFirst.mockResolvedValue({
      id: SCHEDULE_ID,
    } as never);
    // No user of the caller's organization matches.
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({
      userid: "foreign",
    } as never);

    const created = await createSchedule(
      createMockRequest("/api/maintenance", {
        method: "POST",
        body: {
          title: "Service",
          assetId: "asset-1",
          frequency: "monthly",
          nextDueDate: "2026-12-01",
          assignedTo: "foreign",
        },
      }) as never,
    );
    const updated = await putSchedule(
      createMockRequest(`/api/maintenance/${SCHEDULE_ID}`, {
        method: "PUT",
        body: { assignedTo: "foreign" },
      }) as never,
      params(SCHEDULE_ID),
    );

    expect(created.status).toBe(404);
    expect(updated.status).toBe(404);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userid: "foreign", organizationId: OWN_ORG },
      }),
    );
    expect(mockPrisma.maintenance_schedules.create).not.toHaveBeenCalled();
    expect(mockPrisma.maintenance_schedules.update).not.toHaveBeenCalled();
  });
});
