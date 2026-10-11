import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn(),
  AUDIT_ACTIONS: { CREATE: "CREATE" },
}));
vi.mock("@/lib/webhooks", () => ({
  getWebhookEvents: () => [{ event: "asset.created" }],
}));
vi.mock("@/lib/encryption", () => ({
  encrypt: (value: string) => `enc:${value}`,
}));

import { GET } from "@/app/api/webhooks/route";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/api-auth";
import { ForbiddenError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);

const OWN_ORG = "org-uuid-001";

const member = {
  id: "member-uuid-001",
  isAdmin: false,
  organizationId: OWN_ORG,
  orgStatus: "active" as const,
};

const list = (query = "") => GET(createMockRequest(`/api/webhooks${query}`));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue(member as never);
  mockPrisma.webhook.findMany.mockResolvedValue([]);
  mockPrisma.webhook.count.mockResolvedValue(0);
});

describe("GET /api/webhooks", () => {
  it("lists the caller's org webhooks plus global ones", async () => {
    const res = await list();

    expect(res.status).toBe(200);
    expect(mockPrisma.webhook.findMany.mock.calls[0][0]?.where).toEqual({
      OR: [{ organizationId: OWN_ORG }, { organizationId: null }],
    });
  });

  it("keeps the org scope when a search term is paginated", async () => {
    await list("?page=1&search=ops");

    expect(mockPrisma.webhook.findMany.mock.calls[0][0]?.where).toMatchObject({
      AND: [
        { OR: [{ organizationId: OWN_ORG }, { organizationId: null }] },
        { OR: expect.any(Array) },
      ],
    });
  });

  it("lists nothing and queries nothing for a caller without an organization", async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      ...member,
      organizationId: undefined,
    } as never);

    const { status, body } = await parseResponse<unknown[]>(await list());

    expect(status).toBe(200);
    expect(body).toEqual([]);
    expect(mockPrisma.webhook.findMany).not.toHaveBeenCalled();
  });

  it("answers an empty page for a paginated list without an organization", async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      ...member,
      organizationId: undefined,
    } as never);

    const { status, body } = await parseResponse<{
      data: unknown[];
      total: number;
      totalPages: number;
    }>(await list("?page=1&pageSize=10"));

    expect(status).toBe(200);
    expect(body).toMatchObject({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    });
    expect(mockPrisma.webhook.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.webhook.count).not.toHaveBeenCalled();
  });

  it("maps a missing permission to 403", async () => {
    vi.mocked(requirePermission).mockRejectedValue(
      new ForbiddenError("insufficient_permission", "webhook:view required"),
    );

    const res = await list();

    expect(res.status).toBe(403);
    expect(mockPrisma.webhook.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/webhooks secrets", () => {
  const withSecret = (id: string, organizationId: string | null) => ({
    id,
    name: id,
    url: "https://example.com/hook",
    secret: "enc:v1:ciphertext",
    organizationId,
  });

  beforeEach(() => {
    mockPrisma.webhook.findMany.mockResolvedValue([
      withSecret("hook-own", OWN_ORG),
      // Global webhooks are listed to every tenant.
      withSecret("hook-global", null),
      { ...withSecret("hook-unsigned", OWN_ORG), secret: null },
    ] as never);
    mockPrisma.webhook.count.mockResolvedValue(3);
  });

  it("never returns the stored secret in the list", async () => {
    const { body } = await parseResponse<Array<Record<string, unknown>>>(
      await list(),
    );

    expect(JSON.stringify(body)).not.toContain("ciphertext");
    for (const hook of body) expect(hook).not.toHaveProperty("secret");
    expect(body.map((hook) => hook.hasSecret)).toEqual([true, true, false]);
  });

  it("never returns the stored secret in a paginated list", async () => {
    const { body } = await parseResponse<{
      data: Array<Record<string, unknown>>;
    }>(await list("?page=1"));

    expect(JSON.stringify(body)).not.toContain("ciphertext");
    for (const hook of body.data) expect(hook).not.toHaveProperty("secret");
  });
});
