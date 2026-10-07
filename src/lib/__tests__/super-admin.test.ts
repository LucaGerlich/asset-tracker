import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma");

import prisma from "@/lib/prisma";
import { getSuperAdminEmails, isSuperAdmin } from "@/lib/super-admin";

const mockPrisma = vi.mocked(prisma, true);

describe("getSuperAdminEmails", () => {
  const originalEnv = process.env.SUPER_ADMIN_EMAILS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SUPER_ADMIN_EMAILS;
    } else {
      process.env.SUPER_ADMIN_EMAILS = originalEnv;
    }
  });

  it("trims, lower-cases and drops empty entries", () => {
    process.env.SUPER_ADMIN_EMAILS = " , A@x.io ,";
    expect(getSuperAdminEmails()).toEqual(["a@x.io"]);
  });

  it("returns an empty list when the variable is unset", () => {
    delete process.env.SUPER_ADMIN_EMAILS;
    expect(getSuperAdminEmails()).toEqual([]);
  });

  it("returns an empty list when the variable is blank", () => {
    process.env.SUPER_ADMIN_EMAILS = "  ,  ";
    expect(getSuperAdminEmails()).toEqual([]);
  });
});

describe("isSuperAdmin", () => {
  const originalEnv = process.env.SUPER_ADMIN_EMAILS;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SUPER_ADMIN_EMAILS;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SUPER_ADMIN_EMAILS;
    } else {
      process.env.SUPER_ADMIN_EMAILS = originalEnv;
    }
  });

  describe("with SUPER_ADMIN_EMAILS set", () => {
    beforeEach(() => {
      process.env.SUPER_ADMIN_EMAILS = "root@x.io, ops@x.io";
    });

    it("allows a listed email that is held by exactly one user", async () => {
      mockPrisma.user.count.mockResolvedValue(1);

      await expect(
        isSuperAdmin({ id: "u1", email: "root@x.io" }),
      ).resolves.toBe(true);
      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: { email: { equals: "root@x.io", mode: "insensitive" } },
      });
    });

    it("matches the list case-insensitively", async () => {
      mockPrisma.user.count.mockResolvedValue(1);

      await expect(
        isSuperAdmin({ id: "u1", email: "Root@X.io" }),
      ).resolves.toBe(true);
    });

    it("denies a listed email when a case-variant duplicate exists", async () => {
      mockPrisma.user.count.mockResolvedValue(2);

      await expect(
        isSuperAdmin({ id: "u1", email: "root@x.io" }),
      ).resolves.toBe(false);
    });

    it("denies an email that is not listed without touching the database", async () => {
      await expect(
        isSuperAdmin({ id: "u1", email: "someone@x.io" }),
      ).resolves.toBe(false);
      expect(mockPrisma.user.count).not.toHaveBeenCalled();
      expect(mockPrisma.organization.count).not.toHaveBeenCalled();
    });

    it("denies a user without an email", async () => {
      await expect(isSuperAdmin({ id: "u1", email: null })).resolves.toBe(
        false,
      );
      await expect(isSuperAdmin({ id: "u1" })).resolves.toBe(false);
    });

    it("does not fall back to the single-org rule", async () => {
      mockPrisma.organization.count.mockResolvedValue(1);

      await expect(
        isSuperAdmin({ id: "u1", email: "someone@x.io" }),
      ).resolves.toBe(false);
    });

    it("never matches an untrimmed stored email against the list", async () => {
      mockPrisma.user.count.mockResolvedValue(1);

      await expect(
        isSuperAdmin({ id: "u1", email: " root@x.io" }),
      ).resolves.toBe(false);
    });
  });

  describe("with SUPER_ADMIN_EMAILS unset", () => {
    it("allows when the platform has a single organization", async () => {
      mockPrisma.organization.count.mockResolvedValue(1);

      await expect(isSuperAdmin({ id: "u1", email: "a@x.io" })).resolves.toBe(
        true,
      );
    });

    it("allows when the platform has no organization yet", async () => {
      mockPrisma.organization.count.mockResolvedValue(0);

      await expect(isSuperAdmin({ id: "u1", email: null })).resolves.toBe(true);
    });

    it("denies once a second organization exists", async () => {
      mockPrisma.organization.count.mockResolvedValue(2);

      await expect(isSuperAdmin({ id: "u1", email: "a@x.io" })).resolves.toBe(
        false,
      );
    });

    it("treats a blank list like an unset one", async () => {
      process.env.SUPER_ADMIN_EMAILS = " , ";
      mockPrisma.organization.count.mockResolvedValue(2);

      await expect(isSuperAdmin({ id: "u1", email: "a@x.io" })).resolves.toBe(
        false,
      );
    });
  });
});
