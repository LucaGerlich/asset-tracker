import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma");

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/lib/org-suspension", () => ({
  getOrgSuspensionStatus: vi.fn().mockResolvedValue("active"),
  requireActiveOrg: vi.fn().mockReturnValue(null),
  requireWriteAccess: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: vi.fn(),
  hasAnyPermission: vi.fn(),
}));

import {
  requireApiAuth,
  requireApiAdmin,
  requireSuperAdmin,
  requirePermission,
} from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getOrgSuspensionStatus, requireActiveOrg } from "@/lib/org-suspension";
import { hasPermission } from "@/lib/rbac";

const mockPrisma = vi.mocked(prisma, true);
const mockAuth = vi.mocked(auth, true);
const mockGetOrgSuspensionStatus = vi.mocked(getOrgSuspensionStatus);
const mockRequireActiveOrg = vi.mocked(requireActiveOrg);
const mockHasPermission = vi.mocked(hasPermission);

const activeSession = { user: { id: "user-1" } };

const activeDbUser = {
  userid: "user-1",
  username: "jdoe",
  firstname: "Jane",
  lastname: "Doe",
  email: "jane@example.com",
  isadmin: false,
  canrequest: true,
  organizationId: "org-1",
  departmentId: null,
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOrgSuspensionStatus.mockResolvedValue("active");
  mockRequireActiveOrg.mockReturnValue(null);
  mockAuth.api.getSession.mockResolvedValue(activeSession as any);
  mockPrisma.user.findUnique.mockResolvedValue(activeDbUser as any);
});

describe("requireApiAuth", () => {
  it("throws Unauthorized when there is no session", async () => {
    mockAuth.api.getSession.mockResolvedValue(null as any);

    await expect(requireApiAuth()).rejects.toThrow("Unauthorized");
  });

  it("throws Unauthorized when the db user is not active", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...activeDbUser,
      isActive: false,
    } as any);

    await expect(requireApiAuth()).rejects.toThrow("Unauthorized");
  });

  it("returns the authenticated user when session and db user are valid", async () => {
    const user = await requireApiAuth();

    expect(user.id).toBe("user-1");
    expect(user.organizationId).toBe("org-1");
  });
});

describe("requirePermission", () => {
  it("throws Forbidden for a non-admin lacking the permission", async () => {
    mockHasPermission.mockResolvedValue(false);

    await expect(requirePermission("asset:view")).rejects.toThrow(
      "Forbidden: Insufficient permissions",
    );
  });

  it("passes for an admin without checking RBAC permissions", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...activeDbUser,
      isadmin: true,
    } as any);

    const user = await requirePermission("asset:view");

    expect(user.isAdmin).toBe(true);
    expect(mockHasPermission).not.toHaveBeenCalled();
  });

  it("passes for a non-admin who has the permission", async () => {
    mockHasPermission.mockResolvedValue(true);

    const user = await requirePermission("asset:view");

    expect(user.id).toBe("user-1");
  });
});

describe("requireApiAdmin", () => {
  it("throws Forbidden for a non-admin", async () => {
    await expect(requireApiAdmin()).rejects.toThrow(
      "Forbidden: Admin access required",
    );
  });

  it("returns the user for an admin", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...activeDbUser,
      isadmin: true,
    } as any);

    const user = await requireApiAdmin();
    expect(user.isAdmin).toBe(true);
  });
});

describe("requireSuperAdmin", () => {
  const originalEnv = process.env.SUPER_ADMIN_EMAILS;

  beforeEach(() => {
    process.env.SUPER_ADMIN_EMAILS = "super@example.com";
    mockPrisma.user.findUnique.mockResolvedValue({
      ...activeDbUser,
      isadmin: true,
    } as any);
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SUPER_ADMIN_EMAILS;
    } else {
      process.env.SUPER_ADMIN_EMAILS = originalEnv;
    }
  });

  it("throws Forbidden when the admin's email is not in SUPER_ADMIN_EMAILS", async () => {
    await expect(requireSuperAdmin()).rejects.toThrow(
      "Forbidden: Super-admin access required",
    );
  });

  it("returns the user when the admin's email is in SUPER_ADMIN_EMAILS", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...activeDbUser,
      isadmin: true,
      email: "super@example.com",
    } as any);

    const user = await requireSuperAdmin();
    expect(user.email).toBe("super@example.com");
  });
});
