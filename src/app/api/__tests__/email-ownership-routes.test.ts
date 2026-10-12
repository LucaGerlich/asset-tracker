import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");

vi.mock("@/lib/rbac", () => ({
  hasPermission: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn().mockResolvedValue({
    organization: { id: "org-uuid-001", name: "Test Org" },
  }),
  scopeToOrganization: vi.fn((where: object) => ({
    ...where,
    organizationId: "org-uuid-001",
  })),
}));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
}));
vi.mock("@/lib/auth-utils", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_password"),
  setUserPassword: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { CREATE: "create" },
  AUDIT_ENTITIES: { USER: "user" },
}));
vi.mock("@/lib/integrations/slack-teams", () => ({
  notifyIntegrations: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/tenant-limits", () => ({
  checkUserLimit: vi.fn().mockResolvedValue({ allowed: true, max: -1 }),
  checkAssetLimit: vi.fn().mockResolvedValue({ allowed: true, max: -1 }),
}));
vi.mock("@/lib/cache", () => ({
  invalidateCacheByPrefix: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/magic-link", () => ({
  sendSetPasswordLink: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/rate-limit", () => ({
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  createRateLimitResponse: vi.fn(),
}));
vi.mock("@/lib/org-defaults", () => ({
  seedOrgDefaults: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-password") },
}));

import { PUT as updateUser } from "@/app/api/user/route";
import { POST as addUser } from "@/app/api/user/addUser/route";
import { POST as importCsv } from "@/app/api/import/route";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as acceptInvite } from "@/app/api/team/invite/[token]/route";
import prisma from "@/lib/prisma";
import { requireApiAuth, requirePermission } from "@/lib/api-auth";

const mockPrisma = vi.mocked(prisma, true);

const RESERVED = "root@example.com";
const SECOND_RESERVED = "ops@example.com";
const OTHER_USER_ID = "someone-else";

/** Who holds which address (lower-cased), as the exact-match queries see it. */
const emailHolders = new Map<string, string[]>();

function holdEmail(email: string, userId: string) {
  emailHolders.set(email.toLowerCase(), [
    ...(emailHolders.get(email.toLowerCase()) ?? []),
    userId,
  ]);
}

/**
 * Answer the exact-match email lookups (src/lib/user-email-query.ts) from
 * `emailHolders`, comparing case-insensitively like the real lower() = lower().
 */
function emulateEmailLookups() {
  mockPrisma.$queryRaw.mockImplementation((async (query: Prisma.Sql) => {
    const holdersOf = (email: string) =>
      emailHolders.get(email.toLowerCase()) ?? [];

    if (query.text.includes(`"userid" = $1::uuid`)) {
      const [userId, email] = query.values as [string, string];
      return [{ count: holdersOf(email).includes(userId) ? 1 : 0 }];
    }
    const [email, excludeUserId] = query.values as [string, string?];
    return [
      { count: holdersOf(email).filter((id) => id !== excludeUserId).length },
    ];
  }) as never);
}

/** The exact-match queries that excluded the given user (conflict lookups). */
function conflictLookupsExcluding(userId: string): Prisma.Sql[] {
  return mockPrisma.$queryRaw.mock.calls
    .map(([query]) => query as unknown as Prisma.Sql)
    .filter((query) => query.values.includes(userId));
}

function asAdmin(email: string) {
  const user = {
    id: "admin-uuid-001",
    isAdmin: true,
    email,
    organizationId: "org-uuid-001",
    orgStatus: "active" as const,
  };
  vi.mocked(requireApiAuth).mockResolvedValue(user as never);
  vi.mocked(requirePermission).mockResolvedValue(user as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("SUPER_ADMIN_EMAILS", `${RESERVED},${SECOND_RESERVED}`);
  vi.stubEnv("ALLOW_PUBLIC_SIGNUP", "true");
  asAdmin("admin@example.com");
  mockPrisma.user.findFirst.mockReset();
  mockPrisma.user.findFirst.mockResolvedValue(null);
  emailHolders.clear();
  emulateEmailLookups();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PUT /api/user", () => {
  const put = (body: Record<string, unknown>) =>
    updateUser(
      createMockRequest("/api/user", {
        method: "PUT",
        body: { userid: "user-uuid-002", ...body },
      }),
    );

  beforeEach(() => {
    // The org-scoped target lookup.
    mockPrisma.user.findFirst.mockResolvedValue({
      userid: "user-uuid-002",
    } as never);
  });

  it("returns 409 when another user already holds the email", async () => {
    holdEmail("taken@example.com", OTHER_USER_ID);

    const { status, body } = await parseResponse<{ error: string }>(
      await put({ email: "Taken@Example.com" }),
    );

    expect(status).toBe(409);
    expect(body.error).toBe("Email is already in use");
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects a reserved super-admin address for a non-super-admin", async () => {
    const { status, body } = await parseResponse<{ code: string }>(
      await put({ email: RESERVED }),
    );

    expect(status).toBe(403);
    expect(body.code).toBe("not_super_admin");
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("lets a super-admin assign a reserved address", async () => {
    asAdmin(RESERVED);
    holdEmail(RESERVED, "admin-uuid-001");

    const { status } = await parseResponse(
      await put({ email: SECOND_RESERVED }),
    );

    expect(status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: SECOND_RESERVED }),
      }),
    );
  });

  it("keeps a reserved address on the account that already holds it", async () => {
    holdEmail(RESERVED, "user-uuid-002");

    const { status } = await parseResponse(
      await put({ email: "Root@Example.com" }),
    );

    expect(status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: RESERVED }),
      }),
    );
  });

  it("still rejects a reserved address held by a different account", async () => {
    holdEmail(RESERVED, OTHER_USER_ID);

    const { status, body } = await parseResponse<{ code: string }>(
      await put({ email: RESERVED }),
    );

    expect(status).toBe(403);
    expect(body.code).toBe("not_super_admin");
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("stores the normalised email and excludes the edited user", async () => {
    const { status } = await parseResponse(
      await put({ email: "New.Address@Example.com" }),
    );

    expect(status).toBe(200);
    const [lookup] = conflictLookupsExcluding("user-uuid-002");
    expect(lookup.text).toContain(`"userid" <> $2::uuid`);
    expect(lookup.values).toEqual(["new.address@example.com", "user-uuid-002"]);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "new.address@example.com" }),
      }),
    );
  });

  it("skips the ownership check when no email is being set", async () => {
    const { status } = await parseResponse(await put({ firstname: "Jane" }));

    expect(status).toBe(200);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });
});

describe("POST /api/user/addUser", () => {
  const create = (email: string) =>
    addUser(
      createMockRequest("/api/user/addUser", {
        method: "POST",
        body: {
          username: "newuser",
          firstname: "New",
          lastname: "User",
          email,
          passwordMode: "manual",
        },
      }),
    );

  it("returns 409 when another user already holds the email", async () => {
    holdEmail("taken@example.com", OTHER_USER_ID);

    const { status, body } = await parseResponse<{ error: string }>(
      await create("Taken@Example.com"),
    );

    expect(status).toBe(409);
    expect(body.error).toBe("Email is already in use");
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects a reserved super-admin address for a non-super-admin", async () => {
    const { status, body } = await parseResponse<{ code: string }>(
      await create(RESERVED),
    );

    expect(status).toBe(403);
    expect(body.code).toBe("not_super_admin");
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("creates the user with the normalised email", async () => {
    const { status } = await parseResponse(await create("New@Example.com"));

    expect(status).toBe(201);
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "new@example.com" }),
      }),
    );
  });
});

describe("POST /api/import (user rows)", () => {
  const importUsers = (csv: string) => {
    const form = new FormData();
    form.set("file", new File([csv], "users.csv", { type: "text/csv" }));
    form.set("entityType", "user");
    return importCsv(
      new NextRequest("http://localhost:3000/api/import", {
        method: "POST",
        body: form,
      }),
    );
  };

  it("fails only the rows with a taken or reserved email", async () => {
    holdEmail("taken@example.com", OTHER_USER_ID);
    mockPrisma.user.create.mockResolvedValue({ userid: "imported" } as never);

    const csv = [
      "username,email,firstname,lastname",
      "a,Taken@Example.com,A,A",
      `b,${RESERVED},B,B`,
      "c,Fresh@Example.com,C,C",
    ].join("\n");
    const res = await importUsers(csv);

    expect(res.status).toBe(201);
    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "fresh@example.com" }),
      }),
    );

    const finalUpdate = mockPrisma.importJob.update.mock.calls.at(-1)?.[0];
    expect(finalUpdate?.data).toMatchObject({
      successCount: 1,
      errorCount: 2,
      errors: [
        { row: 2, error: "Email is already in use" },
        { row: 3, error: "Forbidden: This email address is reserved" },
      ],
    });
  });

  it("lets a super-admin import a reserved address", async () => {
    asAdmin(RESERVED);
    holdEmail(RESERVED, "admin-uuid-001");
    mockPrisma.user.create.mockResolvedValue({ userid: "imported" } as never);

    const res = await importUsers(
      ["username,email,firstname,lastname", `b,${SECOND_RESERVED},B,B`].join(
        "\n",
      ),
    );

    expect(res.status).toBe(201);
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: SECOND_RESERVED }),
      }),
    );
  });
});

describe("POST /api/auth/register", () => {
  const signUp = (email: string) =>
    register(
      createMockRequest("/api/auth/register", {
        method: "POST",
        body: {
          firstname: "Test",
          lastname: "User",
          email,
          organization: "Test Corp",
          username: "testuser",
          password: "SecurePass123!",
        },
      }),
    );

  beforeEach(() => {
    mockPrisma.organization.create.mockResolvedValue({
      id: "new-org",
    } as never);
    mockPrisma.user.create.mockResolvedValue({ userid: "new-user" } as never);
  });

  it("answers a reserved super-admin address like a taken one", async () => {
    const { status, body } = await parseResponse<{ message: string }>(
      await signUp("Root@Example.com"),
    );

    expect(status).toBe(409);
    expect(body.message).toBe("Email is already taken.");
    expect(mockPrisma.organization.create).not.toHaveBeenCalled();
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects an address that differs from an existing one only by case", async () => {
    holdEmail("taken@example.com", OTHER_USER_ID);

    const { status, body } = await parseResponse<{ message: string }>(
      await signUp("Taken@Example.com"),
    );

    expect(status).toBe(409);
    expect(body.message).toBe("Email is already taken.");
    expect(mockPrisma.organization.create).not.toHaveBeenCalled();
  });

  it("creates the account with the normalised email", async () => {
    const { status } = await parseResponse(await signUp("New@Example.com"));

    expect(status).toBe(201);
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "new@example.com" }),
      }),
    );
  });
});

describe("POST /api/team/invite/[token]", () => {
  const params = { params: Promise.resolve({ token: "invite-token" }) };

  const accept = () =>
    acceptInvite(
      createMockRequest("/api/team/invite/invite-token", {
        method: "POST",
        body: {
          firstname: "In",
          lastname: "Vited",
          password: "SecurePass123!",
        },
      }),
      params,
    );

  const invitationFor = (email: string) =>
    ({
      id: "invitation-1",
      email,
      status: "pending",
      expiresAt: new Date(Date.now() + 60_000),
      invitedBy: "admin-uuid-001",
      organization: { id: "org-uuid-001", name: "Test Org" },
      role: null,
      inviter: { firstname: "A", lastname: "B" },
    }) as never;

  it("refuses to create a user on a reserved super-admin address", async () => {
    mockPrisma.teamInvitation.findUnique.mockResolvedValue(
      invitationFor(RESERVED),
    );

    const { status, body } = await parseResponse<{ code: string }>(
      await accept(),
    );

    expect(status).toBe(403);
    expect(body.code).toBe("not_super_admin");
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockPrisma.teamInvitation.update).not.toHaveBeenCalled();
  });

  it("returns 409 when a case-variant of the address is already in use", async () => {
    mockPrisma.teamInvitation.findUnique.mockResolvedValue(
      invitationFor("taken@example.com"),
    );
    // The exact-match existing-user lookup misses; the ownership check hits.
    holdEmail("Taken@Example.com", OTHER_USER_ID);

    const { status, body } = await parseResponse<{ error: string }>(
      await accept(),
    );

    expect(status).toBe(409);
    expect(body.error).toBe("Email is already in use");
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("creates the invited user with the normalised email", async () => {
    mockPrisma.teamInvitation.findUnique.mockResolvedValue(
      invitationFor("Fresh@Example.com"),
    );
    mockPrisma.user.create.mockResolvedValue({ userid: "invited" } as never);

    const { status } = await parseResponse(await accept());

    expect(status).toBe(200);
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "fresh@example.com",
          username: "fresh@example.com",
        }),
      }),
    );
  });
});
