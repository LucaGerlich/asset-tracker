import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Prisma } from "@prisma/client";

vi.mock("@/lib/prisma");

import prisma from "@/lib/prisma";
import {
  assertEmailAssignable,
  EmailConflictError,
  normalizeEmail,
} from "@/lib/email-ownership";
import { ForbiddenError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);

/** The n-th parameterized statement sent through prisma.$queryRaw. */
function sentQuery(index = 0): Prisma.Sql {
  return mockPrisma.$queryRaw.mock.calls[index][0] as unknown as Prisma.Sql;
}

/** Make the next exact-match lookup report this many matching users. */
function matchingUsers(count: number) {
  mockPrisma.$queryRaw.mockResolvedValueOnce([{ count }]);
}

describe("normalizeEmail", () => {
  it("trims and lower-cases", () => {
    expect(normalizeEmail(" A@B.io ")).toBe("a@b.io");
  });
});

describe("EmailConflictError", () => {
  it("is a 409 with a stable message", () => {
    const error = new EmailConflictError();
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe("Email is already in use");
  });
});

describe("assertEmailAssignable", () => {
  const originalEnv = process.env.SUPER_ADMIN_EMAILS;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SUPER_ADMIN_EMAILS;
    mockPrisma.$queryRaw.mockReset();
    mockPrisma.$queryRaw.mockResolvedValue([{ count: 0 }]);
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SUPER_ADMIN_EMAILS;
    } else {
      process.env.SUPER_ADMIN_EMAILS = originalEnv;
    }
  });

  it("returns the normalised email when nobody else holds it", async () => {
    await expect(
      assertEmailAssignable(" New@B.io ", { callerIsSuperAdmin: false }),
    ).resolves.toBe("new@b.io");
  });

  it("looks for other holders with an exact lower() comparison", async () => {
    await assertEmailAssignable("A@b.io", { callerIsSuperAdmin: false });

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    const query = sentQuery();
    expect(query.text).toContain(`lower("email") = lower($1)`);
    expect(query.values).toEqual(["a@b.io"]);
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
  });

  it("treats _ and % in the address as literal characters", async () => {
    await assertEmailAssignable("a_b%@x.io", { callerIsSuperAdmin: false });

    // Equality on a bound value: a_b@x.io can never match aXb@x.io, which an
    // ILIKE with the address as the pattern would.
    const query = sentQuery();
    expect(query.text).not.toMatch(/like/i);
    expect(query.text).not.toContain("a_b");
    expect(query.values).toEqual(["a_b%@x.io"]);
  });

  it("throws a 409 when another user already holds the address", async () => {
    matchingUsers(1);

    const attempt = assertEmailAssignable("A@b.io", {
      callerIsSuperAdmin: false,
    });
    await expect(attempt).rejects.toBeInstanceOf(EmailConflictError);
    await expect(attempt).rejects.toMatchObject({
      statusCode: 409,
      message: "Email is already in use",
    });
  });

  it("excludes the user being edited from the conflict lookup", async () => {
    await expect(
      assertEmailAssignable("a@b.io", {
        excludeUserId: "user-1",
        callerIsSuperAdmin: false,
      }),
    ).resolves.toBe("a@b.io");

    const query = sentQuery();
    expect(query.text).toContain(`"userid" <> $2::uuid`);
    expect(query.values).toEqual(["a@b.io", "user-1"]);
  });

  it("rejects a reserved super-admin address for a non-super-admin caller", async () => {
    process.env.SUPER_ADMIN_EMAILS = "root@x.io";

    const attempt = assertEmailAssignable(" Root@X.io ", {
      callerIsSuperAdmin: false,
    });
    await expect(attempt).rejects.toBeInstanceOf(ForbiddenError);
    await expect(attempt).rejects.toMatchObject({ code: "not_super_admin" });
    await expect(attempt).rejects.toThrow("This email address is reserved");
    // Nothing to compare against without a user id: no database round trip.
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  describe("a reserved address its holder already has", () => {
    beforeEach(() => {
      process.env.SUPER_ADMIN_EMAILS = "root@x.io";
    });

    it("stays assignable to the account that already holds it", async () => {
      matchingUsers(1); // user-1 holds root@x.io
      matchingUsers(0); // nobody else does

      await expect(
        assertEmailAssignable(" Root@X.io ", {
          excludeUserId: "user-1",
          callerIsSuperAdmin: false,
        }),
      ).resolves.toBe("root@x.io");

      const holderCheck = sentQuery(0);
      expect(holderCheck.text).toContain(`"userid" = $1::uuid`);
      expect(holderCheck.text).toContain(`lower("email") = lower($2)`);
      expect(holderCheck.values).toEqual(["user-1", "root@x.io"]);
      expect(sentQuery(1).values).toEqual(["root@x.io", "user-1"]);
    });

    it("is still rejected for another user", async () => {
      matchingUsers(0); // user-2 does not hold root@x.io

      const attempt = assertEmailAssignable("root@x.io", {
        excludeUserId: "user-2",
        callerIsSuperAdmin: false,
      });
      await expect(attempt).rejects.toBeInstanceOf(ForbiddenError);
      await expect(attempt).rejects.toMatchObject({ code: "not_super_admin" });
      // Rejected before any duplicate lookup.
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it("is still rejected when no user is being edited", async () => {
      const attempt = assertEmailAssignable("root@x.io", {
        callerIsSuperAdmin: false,
      });
      await expect(attempt).rejects.toBeInstanceOf(ForbiddenError);
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it("still reports a conflict when a case-variant duplicate exists", async () => {
      matchingUsers(1); // user-1 holds it
      matchingUsers(1); // and so does somebody else

      await expect(
        assertEmailAssignable("root@x.io", {
          excludeUserId: "user-1",
          callerIsSuperAdmin: false,
        }),
      ).rejects.toBeInstanceOf(EmailConflictError);
    });
  });

  it("allows a reserved super-admin address for a super-admin caller", async () => {
    process.env.SUPER_ADMIN_EMAILS = "root@x.io";

    await expect(
      assertEmailAssignable("Root@X.io", { callerIsSuperAdmin: true }),
    ).resolves.toBe("root@x.io");
  });

  it("does not reserve anything when SUPER_ADMIN_EMAILS is unset", async () => {
    await expect(
      assertEmailAssignable("root@x.io", { callerIsSuperAdmin: false }),
    ).resolves.toBe("root@x.io");
  });
});
