import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/rbac", () => ({ hasPermission: vi.fn() }));
vi.mock("@/lib/auth-utils", () => ({ setUserPassword: vi.fn() }));
vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/cache", () => ({
  invalidateCacheByPrefix: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn().mockResolvedValue(null),
  scopeToOrganization: vi.fn(
    (where: Record<string, unknown>, organizationId?: string | null) => ({
      ...where,
      organizationId: organizationId ?? null,
    }),
  ),
}));

import { PUT } from "@/app/api/user/route";
import prisma from "@/lib/prisma";
import { requireApiAuth, requireWritableOrg } from "@/lib/api-auth";
import { ForbiddenError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);

const OWN_ORG = "org-uuid-001";
const LOADED_AT = new Date("2026-10-01T10:00:00.000Z");
const STALE = new Date("2026-09-01T10:00:00.000Z");

const admin = {
  id: "admin-uuid-001",
  isAdmin: true,
  organizationId: OWN_ORG,
  orgStatus: "active" as const,
};

interface UserRow {
  userid: string;
  organizationId: string | null;
  change_date: Date;
}

const users: UserRow[] = [
  { userid: admin.id, organizationId: OWN_ORG, change_date: LOADED_AT },
  { userid: "user-own", organizationId: OWN_ORG, change_date: LOADED_AT },
  {
    userid: "user-foreign",
    organizationId: "other-org",
    change_date: LOADED_AT,
  },
];

const put = (body: Record<string, unknown>) =>
  PUT(createMockRequest("/api/user", { method: "PUT", body }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireApiAuth).mockResolvedValue(admin as never);
  vi.mocked(requireWritableOrg).mockResolvedValue(undefined);

  // In-memory stand-in with Prisma semantics: a row is only found when every
  // given filter matches.
  mockPrisma.user.findFirst.mockImplementation(
    (async ({
      where,
    }: {
      where: { userid: string; organizationId?: string | null };
    }) =>
      users.find(
        (u) =>
          u.userid === where.userid &&
          (where.organizationId === undefined ||
            u.organizationId === where.organizationId),
      ) ?? null) as never,
  );
  mockPrisma.user.findUnique.mockImplementation(
    (async ({ where }: { where: { userid: string } }) =>
      users.find((u) => u.userid === where.userid) ?? null) as never,
  );
  mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.user.update.mockResolvedValue({
    userid: "user-own",
    organizationId: OWN_ORG,
  } as never);
});

describe("PUT /api/user", () => {
  it("answers 404, not 409, for a user of another org with a stale version", async () => {
    const res = await put({
      userid: "user-foreign",
      firstname: "Changed",
      _expectedVersion: STALE.toISOString(),
    });

    expect(res.status).toBe(404);
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("answers the same 404 for a foreign and a missing user with a version", async () => {
    const [foreign, missing] = await Promise.all(
      ["user-foreign", "user-missing"].map((userid) =>
        put({
          userid,
          firstname: "Changed",
          _expectedVersion: STALE.toISOString(),
        }),
      ),
    );

    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await foreign.json()).toEqual(await missing.json());
  });

  it("answers 404 for a user of another org even when the version matches", async () => {
    const res = await put({
      userid: "user-foreign",
      firstname: "Changed",
      _expectedVersion: LOADED_AT.toISOString(),
    });

    expect(res.status).toBe(404);
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("answers 404 to an admin without an organization for a user of an org", async () => {
    vi.mocked(requireApiAuth).mockResolvedValue({
      ...admin,
      organizationId: undefined,
    } as never);

    const res = await put({
      userid: "user-own",
      firstname: "Changed",
      _expectedVersion: STALE.toISOString(),
    });

    expect(res.status).toBe(404);
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("answers 409 for a user of the caller's org with a stale version", async () => {
    const res = await put({
      userid: "user-own",
      firstname: "Changed",
      _expectedVersion: STALE.toISOString(),
    });

    expect(res.status).toBe(409);
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("answers 409 when an admin edits their own profile with a stale version", async () => {
    const res = await put({
      userid: admin.id,
      firstname: "Changed",
      _expectedVersion: STALE.toISOString(),
    });

    expect(res.status).toBe(409);
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("updates a user of the caller's org when the version matches", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      userid: "user-own",
      organizationId: OWN_ORG,
    } as never);

    const res = await put({
      userid: "user-own",
      firstname: "Changed",
      _expectedVersion: LOADED_AT.toISOString(),
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.user.updateMany).toHaveBeenCalledTimes(1);
  });

  it("answers 403 to a non-admin editing another user, whatever the version", async () => {
    vi.mocked(requireApiAuth).mockResolvedValue({
      ...admin,
      id: "member-uuid-001",
      isAdmin: false,
    } as never);

    const res = await put({
      userid: "user-foreign",
      firstname: "Changed",
      _expectedVersion: STALE.toISOString(),
    });

    expect(res.status).toBe(403);
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns 403 and updates nothing when the org is read-only", async () => {
    vi.mocked(requireWritableOrg).mockRejectedValue(
      new ForbiddenError("org_read_only", "Organization is in read-only mode"),
    );

    const res = await put({ userid: "user-own", firstname: "Changed" });

    expect(res.status).toBe(403);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
