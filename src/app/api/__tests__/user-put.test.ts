import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
import { setUserPassword } from "@/lib/auth-utils";

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
  email?: string | null;
  username?: string;
}

const users: UserRow[] = [
  {
    userid: admin.id,
    organizationId: OWN_ORG,
    change_date: LOADED_AT,
    email: "admin@example.com",
  },
  {
    userid: "user-own",
    organizationId: OWN_ORG,
    change_date: LOADED_AT,
    username: "member@example.com",
  },
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

  describe("self-service credentials", () => {
    const member = {
      ...admin,
      id: "member-uuid-001",
      isAdmin: false,
    };

    beforeEach(() => {
      users.push({
        userid: member.id,
        organizationId: OWN_ORG,
        change_date: LOADED_AT,
        email: "member@example.com",
      });
      vi.mocked(requireApiAuth).mockResolvedValue(member as never);
    });

    afterEach(() => {
      users.splice(
        users.findIndex((u) => u.userid === member.id),
        1,
      );
    });

    it("refuses a user setting their own password here", async () => {
      const res = await put({
        userid: member.id,
        password: "a-very-long-new-password",
      });

      expect(res.status).toBe(400);
      expect(setUserPassword).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("refuses an admin setting their own password here", async () => {
      vi.mocked(requireApiAuth).mockResolvedValue(admin as never);

      const res = await put({
        userid: admin.id,
        password: "a-very-long-new-password",
      });

      expect(res.status).toBe(400);
      expect(setUserPassword).not.toHaveBeenCalled();
    });

    it("refuses a user changing their own email here", async () => {
      const res = await put({
        userid: member.id,
        email: "attacker@example.com",
      });

      expect(res.status).toBe(400);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("accepts the unchanged own email the edit form always sends", async () => {
      mockPrisma.user.update.mockResolvedValue({
        userid: member.id,
        organizationId: OWN_ORG,
      } as never);

      const res = await put({
        userid: member.id,
        email: "Member@Example.com",
        firstname: "Changed",
      });

      expect(res.status).toBe(200);
      expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
      const data = mockPrisma.user.update.mock.calls[0][0].data as Record<
        string,
        unknown
      >;
      expect(data).not.toHaveProperty("email");
    });

    it("still lets an admin set another user's password and email", async () => {
      vi.mocked(requireApiAuth).mockResolvedValue(admin as never);

      const res = await put({
        userid: "user-own",
        password: "a-very-long-new-password",
        email: "new@example.com",
      });

      expect(res.status).toBe(200);
      expect(setUserPassword).toHaveBeenCalledWith(
        "user-own",
        "a-very-long-new-password",
      );
    });
  });
  describe("admin demotion guard", () => {
    it("refuses an admin removing their own admin rights", async () => {
      mockPrisma.user.count.mockResolvedValue(3);

      const res = await put({ userid: admin.id, isadmin: false });

      expect(res.status).toBe(400);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    });

    it("refuses demoting the last active admin of the org", async () => {
      mockPrisma.user.count.mockResolvedValue(0);

      const res = await put({ userid: "user-own", isadmin: false });

      expect(res.status).toBe(400);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("allows demoting another admin while one remains", async () => {
      mockPrisma.user.count.mockResolvedValue(1);

      const res = await put({ userid: "user-own", isadmin: false });

      expect(res.status).toBe(200);
      expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
    });

    it("does not run the guard when isadmin is not being removed", async () => {
      const res = await put({ userid: "user-own", isadmin: true });

      expect(res.status).toBe(200);
      expect(mockPrisma.user.count).not.toHaveBeenCalled();
    });
  });

  describe("username with an at sign", () => {
    it("accepts an unchanged email-style username echoed by the edit form", async () => {
      const res = await put({
        userid: "user-own",
        username: "member@example.com",
        firstname: "Changed",
      });

      expect(res.status).toBe(200);
      expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
    });

    it("still refuses changing the username to one with an at sign", async () => {
      const res = await put({
        userid: "user-own",
        username: "other@example.com",
      });

      expect(res.status).toBe(400);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("own email when none is stored", () => {
    const member = { ...admin, id: "member-no-email", isAdmin: false };

    beforeEach(() => {
      users.push({
        userid: member.id,
        organizationId: OWN_ORG,
        change_date: LOADED_AT,
        email: null,
      });
      vi.mocked(requireApiAuth).mockResolvedValue(member as never);
      mockPrisma.user.update.mockResolvedValue({
        userid: member.id,
        organizationId: OWN_ORG,
      } as never);
    });

    afterEach(() => {
      users.splice(
        users.findIndex((u) => u.userid === member.id),
        1,
      );
    });

    it("lets a user set their own email when it is null", async () => {
      const res = await put({ userid: member.id, email: "new@example.com" });

      expect(res.status).toBe(200);
      const data = mockPrisma.user.update.mock.calls[0][0].data as Record<
        string,
        unknown
      >;
      expect(data.email).toBe("new@example.com");
    });
  });
});
