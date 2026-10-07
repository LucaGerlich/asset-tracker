import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/encryption", () => ({
  encrypt: (value: string) => `enc:${value}`,
}));

import { GET, PUT } from "@/app/api/admin/settings/sso/route";
import prisma from "@/lib/prisma";
import {
  requirePlanFeature,
  requireSuperAdmin,
  requireWritableOrg,
} from "@/lib/api-auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);

const put = (body: Record<string, unknown>) =>
  PUT(
    createMockRequest("/api/admin/settings/sso", {
      method: "PUT",
      body,
    }),
  );

const upsertedKeys = (): string[] =>
  mockPrisma.system_settings.upsert.mock.calls.map(
    ([args]) => args.where.settingKey as string,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSuperAdmin).mockResolvedValue({
    id: "super-uuid-001",
    isAdmin: true,
    organizationId: "org-uuid-001",
    orgStatus: "active" as const,
  } as never);
  vi.mocked(requireWritableOrg).mockResolvedValue(undefined);
});

describe("PUT /api/admin/settings/sso", () => {
  it("saves allow-listed keys", async () => {
    const res = await put({
      settings: [
        { key: "sso.enabled", value: "true" },
        { key: "sso.provider", value: "oidc" },
      ],
    });

    expect(res.status).toBe(200);
    expect(upsertedKeys()).toEqual(["sso.enabled", "sso.provider"]);
  });

  it("answers 400 and upserts nothing for deployment.mode", async () => {
    const res = await put({
      settings: [{ key: "deployment.mode", value: "self-hosted" }],
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Unknown setting keys",
      keys: ["deployment.mode"],
    });
    expect(mockPrisma.system_settings.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("answers 400 and upserts nothing for a sso.token.* login row", async () => {
    const res = await put({
      settings: [{ key: "sso.token.abc123", value: "user-uuid-001" }],
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Unknown setting keys",
      keys: ["sso.token.abc123"],
    });
    expect(mockPrisma.system_settings.upsert).not.toHaveBeenCalled();
  });

  it("rejects the whole request when only one key is unknown", async () => {
    const res = await put({
      settings: [
        { key: "sso.enabled", value: "true" },
        { key: "scim.bearerToken", value: "attacker" },
      ],
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Unknown setting keys",
      keys: ["scim.bearerToken"],
    });
    expect(mockPrisma.system_settings.upsert).not.toHaveBeenCalled();
  });

  it("skips a masked client secret instead of overwriting it", async () => {
    const res = await put({
      settings: [
        { key: "sso.clientId", value: "client-1" },
        { key: "sso.clientSecret", value: "********" },
      ],
    });

    expect(res.status).toBe(200);
    expect(upsertedKeys()).toEqual(["sso.clientId"]);
    const stored = mockPrisma.system_settings.upsert.mock.calls.flatMap(
      ([args]) => [args.update.settingValue, args.create.settingValue],
    );
    expect(stored).not.toContain("********");
  });

  it("encrypts a new client secret", async () => {
    const res = await put({
      settings: [{ key: "sso.clientSecret", value: "new-secret" }],
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.system_settings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { settingKey: "sso.clientSecret" },
        update: expect.objectContaining({ settingValue: "enc:new-secret" }),
        create: expect.objectContaining({
          settingValue: "enc:new-secret",
          isEncrypted: true,
        }),
      }),
    );
  });

  it("does not gate SSO on the caller's plan (operator-level setting)", async () => {
    const res = await put({
      settings: [{ key: "sso.enabled", value: "true" }],
    });

    expect(res.status).toBe(200);
    expect(requirePlanFeature).not.toHaveBeenCalled();
  });

  it.each([
    ["a missing settings array", {}],
    ["a non-array settings field", { settings: "sso.enabled" }],
    ["a numeric value", { settings: [{ key: "sso.enabled", value: 1 }] }],
  ])("answers 400 for %s", async (_label, body) => {
    const res = await put(body);

    expect(res.status).toBe(400);
    expect(mockPrisma.system_settings.upsert).not.toHaveBeenCalled();
  });

  it("answers 400 for a body that is not JSON", async () => {
    const res = await PUT(
      createMockRequest("/api/admin/settings/sso", { method: "PUT" }),
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.system_settings.upsert).not.toHaveBeenCalled();
  });

  it("answers 403 and upserts nothing for a caller who is not a super-admin", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(
      new ForbiddenError("not_super_admin", "Super-admin access required"),
    );

    const res = await put({
      settings: [{ key: "sso.enabled", value: "true" }],
    });

    expect(res.status).toBe(403);
    expect(mockPrisma.system_settings.upsert).not.toHaveBeenCalled();
  });

  it("answers 403 and upserts nothing when the org is read-only", async () => {
    vi.mocked(requireWritableOrg).mockRejectedValue(
      new ForbiddenError("org_read_only", "Organization is in read-only mode"),
    );

    const res = await put({
      settings: [{ key: "sso.enabled", value: "true" }],
    });

    expect(res.status).toBe(403);
    expect(mockPrisma.system_settings.upsert).not.toHaveBeenCalled();
  });

  it("answers 401 for an unauthenticated caller", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(new UnauthorizedError());

    const res = await put({
      settings: [{ key: "sso.enabled", value: "true" }],
    });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/admin/settings/sso", () => {
  it("excludes sso.token.* rows from the query", async () => {
    await GET();

    expect(mockPrisma.system_settings.findMany).toHaveBeenCalledWith({
      where: {
        settingKey: { startsWith: "sso." },
        NOT: { settingKey: { startsWith: "sso.token." } },
      },
    });
  });

  it("masks encrypted values", async () => {
    mockPrisma.system_settings.findMany.mockResolvedValue([
      {
        id: "row-1",
        settingKey: "sso.clientSecret",
        settingValue: "ciphertext",
        settingType: "string",
        description: null,
        isEncrypted: true,
      },
    ] as never);

    const res = await GET();
    const body = (await res.json()) as Array<{ key: string; value: string }>;

    expect(body).toEqual([
      expect.objectContaining({ key: "sso.clientSecret", value: "********" }),
    ]);
  });

  it("answers 403 for a caller who is not a super-admin", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(
      new ForbiddenError("not_super_admin", "Super-admin access required"),
    );

    const res = await GET();

    expect(res.status).toBe(403);
    expect(mockPrisma.system_settings.findMany).not.toHaveBeenCalled();
  });
});
