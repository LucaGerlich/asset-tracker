import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn(),
  AUDIT_ACTIONS: { UPDATE: "UPDATE", DELETE: "DELETE" },
}));
vi.mock("@/lib/webhooks", () => ({
  getWebhookEvents: () => [{ event: "asset.created" }],
}));
vi.mock("@/lib/encryption", () => ({
  encrypt: (value: string) => `enc:${value}`,
}));

import { DELETE, GET, PUT } from "@/app/api/webhooks/[id]/route";
import prisma from "@/lib/prisma";
import { requireApiAdmin, requireWritableOrg } from "@/lib/api-auth";
import { ForbiddenError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);

const OWN_ORG = "org-uuid-001";

const admin = {
  id: "admin-uuid-001",
  isAdmin: true,
  organizationId: OWN_ORG,
  orgStatus: "active" as const,
};

const ownWebhook = {
  id: "hook-own",
  name: "Own hook",
  url: "https://example.com/hook",
  organizationId: OWN_ORG,
  isActive: false,
  retryAttempts: 1,
};

const globalWebhook = {
  ...ownWebhook,
  id: "hook-global",
  organizationId: null,
};

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireApiAdmin).mockResolvedValue(admin as never);
  vi.mocked(requireWritableOrg).mockResolvedValue(undefined);

  // In-memory stand-in with Prisma semantics: an `undefined` org filter
  // matches every org; `null` matches only global webhooks.
  mockPrisma.webhook.findFirst.mockImplementation(
    (async ({
      where,
    }: {
      where: { id: string; organizationId?: string | null };
    }) =>
      [ownWebhook, globalWebhook].find(
        (w) =>
          w.id === where.id &&
          (where.organizationId === undefined ||
            w.organizationId === where.organizationId),
      ) ?? null) as never,
  );
  mockPrisma.webhook.update.mockImplementation((async ({
    data,
  }: {
    data: Record<string, unknown>;
  }) => ({ ...ownWebhook, ...data })) as never);
});

const orgless = () =>
  vi.mocked(requireApiAdmin).mockResolvedValue({
    ...admin,
    organizationId: undefined,
  } as never);

describe("GET /api/webhooks/[id]", () => {
  it("returns a webhook of the caller's org", async () => {
    const res = await GET(
      createMockRequest("/api/webhooks/hook-own"),
      params("hook-own"),
    );
    expect(res.status).toBe(200);
  });

  it("answers 404 for a webhook of another org", async () => {
    const res = await GET(
      createMockRequest("/api/webhooks/hook-foreign"),
      params("hook-foreign"),
    );
    expect(res.status).toBe(404);
  });

  it("answers 404 without querying when the caller has no organization", async () => {
    orgless();

    const res = await GET(
      createMockRequest("/api/webhooks/hook-global"),
      params("hook-global"),
    );

    expect(res.status).toBe(404);
    expect(mockPrisma.webhook.findFirst).not.toHaveBeenCalled();
  });
});

describe("PUT /api/webhooks/[id]", () => {
  const put = (id: string, body: Record<string, unknown>) =>
    PUT(
      createMockRequest(`/api/webhooks/${id}`, { method: "PUT", body }),
      params(id),
    );

  it("writes only the fields that were sent", async () => {
    const res = await put("hook-own", { name: "Renamed" });

    expect(res.status).toBe(200);
    expect(mockPrisma.webhook.update.mock.calls[0][0].data).toEqual({
      name: "Renamed",
      updatedAt: expect.any(Date),
    });
  });

  it("encrypts a new secret", async () => {
    await put("hook-own", { secret: "s3cret" });

    expect(mockPrisma.webhook.update.mock.calls[0][0].data).toMatchObject({
      secret: "enc:s3cret",
    });
  });

  it("answers 404 and updates nothing for a webhook of another org", async () => {
    const res = await put("hook-foreign", { name: "Hijacked" });

    expect(res.status).toBe(404);
    expect(mockPrisma.webhook.update).not.toHaveBeenCalled();
  });

  it("answers 404 and updates nothing when the caller has no organization", async () => {
    orgless();

    const res = await put("hook-global", { name: "Hijacked" });

    expect(res.status).toBe(404);
    expect(mockPrisma.webhook.update).not.toHaveBeenCalled();
  });

  it("returns 403 and updates nothing when the org is read-only", async () => {
    vi.mocked(requireWritableOrg).mockRejectedValue(
      new ForbiddenError("org_read_only", "Organization is in read-only mode"),
    );

    const res = await put("hook-own", { name: "Renamed" });

    expect(res.status).toBe(403);
    expect(mockPrisma.webhook.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/webhooks/[id]", () => {
  const remove = (id: string) =>
    DELETE(
      createMockRequest(`/api/webhooks/${id}`, { method: "DELETE" }),
      params(id),
    );

  it("deletes a webhook of the caller's org", async () => {
    const res = await remove("hook-own");

    expect(res.status).toBe(200);
    expect(mockPrisma.webhook.delete).toHaveBeenCalledWith({
      where: { id: "hook-own" },
    });
  });

  it("answers 404 and deletes nothing for a webhook of another org", async () => {
    const res = await remove("hook-foreign");

    expect(res.status).toBe(404);
    expect(mockPrisma.webhook.delete).not.toHaveBeenCalled();
  });

  it("answers 404 and deletes nothing when the caller has no organization", async () => {
    orgless();

    const res = await remove("hook-global");

    expect(res.status).toBe(404);
    expect(mockPrisma.webhook.delete).not.toHaveBeenCalled();
  });
});
