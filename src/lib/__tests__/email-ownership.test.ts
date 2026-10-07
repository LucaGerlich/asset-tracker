import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma");

import prisma from "@/lib/prisma";
import {
  assertEmailAssignable,
  EmailConflictError,
  normalizeEmail,
} from "@/lib/email-ownership";
import { ForbiddenError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);

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
    mockPrisma.user.findFirst.mockResolvedValue(null);
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

  it("looks for other holders case-insensitively", async () => {
    await assertEmailAssignable("A@b.io", { callerIsSuperAdmin: false });

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: "a@b.io", mode: "insensitive" } },
      select: { userid: true },
    });
  });

  it("throws a 409 when another user already holds the address", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ userid: "other" } as never);

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

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: { equals: "a@b.io", mode: "insensitive" },
        NOT: { userid: "user-1" },
      },
      select: { userid: true },
    });
  });

  it("rejects a reserved super-admin address for a non-super-admin caller", async () => {
    process.env.SUPER_ADMIN_EMAILS = "root@x.io";

    const attempt = assertEmailAssignable(" Root@X.io ", {
      callerIsSuperAdmin: false,
    });
    await expect(attempt).rejects.toBeInstanceOf(ForbiddenError);
    await expect(attempt).rejects.toMatchObject({ code: "not_super_admin" });
    await expect(attempt).rejects.toThrow("This email address is reserved");
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
