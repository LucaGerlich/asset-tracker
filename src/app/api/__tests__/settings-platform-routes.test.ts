import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/encryption", () => ({
  encrypt: (value: string) => `enc:${value}`,
}));

import { PUT as putLdap } from "@/app/api/admin/settings/ldap/route";
import { PUT as putIntune } from "@/app/api/admin/settings/intune/route";
import { PUT as putIntegrations } from "@/app/api/admin/settings/integrations/route";
import prisma from "@/lib/prisma";
import {
  requirePlanFeature,
  requireSuperAdmin,
  requireWritableOrg,
} from "@/lib/api-auth";
import { ForbiddenError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);

interface RouteCase {
  name: string;
  put: (req: Request) => Promise<Response>;
  url: string;
  allowedKey: string;
  secretKey: string;
}

const ROUTES: RouteCase[] = [
  {
    name: "ldap",
    put: putLdap,
    url: "/api/admin/settings/ldap",
    allowedKey: "ldap.serverUrl",
    secretKey: "ldap.bindPassword",
  },
  {
    name: "intune",
    put: putIntune,
    url: "/api/admin/settings/intune",
    allowedKey: "intune.tenantId",
    secretKey: "intune.clientSecret",
  },
  {
    name: "integrations",
    put: putIntegrations,
    url: "/api/admin/settings/integrations",
    allowedKey: "integrations.slack.channel",
    secretKey: "integrations.slack.webhookUrl",
  },
];

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

describe.each(ROUTES)("PUT $url", (route) => {
  const send = (body: Record<string, unknown>) =>
    route.put(createMockRequest(route.url, { method: "PUT", body }));

  it("saves allow-listed keys", async () => {
    const res = await send({
      settings: [{ key: route.allowedKey, value: "value" }],
    });

    expect(res.status).toBe(200);
    expect(upsertedKeys()).toEqual([route.allowedKey]);
  });

  it.each(["deployment.mode", "sso.token.abc", "scim.bearerToken"])(
    "answers 400 and upserts nothing for %s",
    async (key) => {
      const res = await send({
        settings: [
          { key: route.allowedKey, value: "value" },
          { key, value: "x" },
        ],
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "Unknown setting keys",
        keys: [key],
      });
      expect(mockPrisma.system_settings.upsert).not.toHaveBeenCalled();
    },
  );

  it("rejects a key that belongs to another settings group", async () => {
    const otherGroupKey = ROUTES.find((r) => r.name !== route.name)!.allowedKey;

    const res = await send({ settings: [{ key: otherGroupKey, value: "x" }] });

    expect(res.status).toBe(400);
    expect(mockPrisma.system_settings.upsert).not.toHaveBeenCalled();
  });

  it("skips a masked secret instead of overwriting it", async () => {
    const res = await send({
      settings: [
        { key: route.allowedKey, value: "value" },
        { key: route.secretKey, value: "********" },
      ],
    });

    expect(res.status).toBe(200);
    expect(upsertedKeys()).toEqual([route.allowedKey]);
  });

  it("encrypts a new secret", async () => {
    const res = await send({
      settings: [{ key: route.secretKey, value: "new-secret" }],
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.system_settings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ settingValue: "enc:new-secret" }),
        create: expect.objectContaining({
          settingValue: "enc:new-secret",
          isEncrypted: true,
        }),
      }),
    );
  });

  it("does not gate the route on the caller's plan", async () => {
    await send({ settings: [{ key: route.allowedKey, value: "value" }] });

    expect(requirePlanFeature).not.toHaveBeenCalled();
  });

  it("answers 403 and upserts nothing for a caller who is not a super-admin", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(
      new ForbiddenError("not_super_admin", "Super-admin access required"),
    );

    const res = await send({
      settings: [{ key: route.allowedKey, value: "value" }],
    });

    expect(res.status).toBe(403);
    expect(mockPrisma.system_settings.upsert).not.toHaveBeenCalled();
  });

  it("answers 400 for a malformed payload", async () => {
    const res = await send({ settings: "nope" });

    expect(res.status).toBe(400);
    expect(mockPrisma.system_settings.upsert).not.toHaveBeenCalled();
  });
});
