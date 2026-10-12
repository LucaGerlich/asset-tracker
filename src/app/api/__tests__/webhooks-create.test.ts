import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

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

import { POST } from "@/app/api/webhooks/route";
import prisma from "@/lib/prisma";
import {
  requirePermission,
  requireSuperAdmin,
  requireWritableOrg,
} from "@/lib/api-auth";
import { ForbiddenError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);

const OWN_ORG = "org-uuid-001";

const manager = {
  id: "manager-uuid-001",
  isAdmin: true,
  organizationId: OWN_ORG,
  orgStatus: "active" as const,
};

const orglessManager = { ...manager, organizationId: undefined };

const create = () =>
  POST(
    createMockRequest("/api/webhooks", {
      method: "POST",
      body: {
        name: "Hook",
        url: "https://example.com/hook",
        events: ["asset.created"],
      },
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue(manager as never);
  vi.mocked(requireSuperAdmin).mockResolvedValue(manager as never);
  vi.mocked(requireWritableOrg).mockResolvedValue(undefined);
  mockPrisma.webhook.create.mockResolvedValue({
    id: "hook-new",
    name: "Hook",
    url: "https://example.com/hook",
    events: ["asset.created"],
  } as never);
});

describe("POST /api/webhooks", () => {
  it("creates the webhook in the caller's org without a super-admin check", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(
      new ForbiddenError("not_super_admin", "Super-admin access required"),
    );

    const res = await create();

    expect(res.status).toBe(201);
    expect(requireSuperAdmin).not.toHaveBeenCalled();
    expect(mockPrisma.webhook.create.mock.calls[0][0].data).toMatchObject({
      organizationId: OWN_ORG,
    });
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("answers 403 and creates nothing when a caller without an organization is not a super-admin", async () => {
    vi.mocked(requirePermission).mockResolvedValue(orglessManager as never);
    vi.mocked(requireSuperAdmin).mockRejectedValue(
      new ForbiddenError("not_super_admin", "Super-admin access required"),
    );

    const res = await create();

    expect(res.status).toBe(403);
    expect(mockPrisma.webhook.create).not.toHaveBeenCalled();
  });

  it("lets a super-admin without an organization create a global webhook", async () => {
    vi.mocked(requirePermission).mockResolvedValue(orglessManager as never);

    const res = await create();

    expect(res.status).toBe(201);
    expect(requireSuperAdmin).toHaveBeenCalledTimes(1);
    expect(mockPrisma.webhook.create.mock.calls[0][0].data).toMatchObject({
      organizationId: null,
    });
  });

  it("returns 403 and creates nothing when the org is read-only", async () => {
    vi.mocked(requireWritableOrg).mockRejectedValue(
      new ForbiddenError("org_read_only", "Organization is in read-only mode"),
    );

    const res = await create();

    expect(res.status).toBe(403);
    expect(mockPrisma.webhook.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhooks response", () => {
  it("does not echo the stored secret back", async () => {
    mockPrisma.webhook.create.mockResolvedValue({
      id: "hook-new",
      name: "Hook",
      url: "https://example.com/hook",
      events: ["asset.created"],
      secret: "enc:v1:ciphertext",
    } as never);

    const res = await create();
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(201);
    expect(JSON.stringify(body)).not.toContain("ciphertext");
    expect(body).not.toHaveProperty("secret");
    expect(body.hasSecret).toBe(true);
  });
});
