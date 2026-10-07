import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma");

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@/lib/org-suspension", () => ({
  resolveOrgStatus: vi.fn().mockReturnValue("active"),
}));

vi.mock("@/lib/api-keys", () => ({
  validateApiKey: vi.fn(),
}));

vi.mock("@/lib/rbac", () => ({
  hasPermission: vi.fn(),
  hasAnyPermission: vi.fn(),
}));

vi.mock("@/lib/super-admin", () => ({
  isSuperAdmin: vi.fn(),
}));

import { headers } from "next/headers";
import {
  requireApiAuth,
  requireApiAdmin,
  requireApiCanRequest,
  requireSuperAdmin,
  requirePermission,
  requireWritableOrg,
} from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { resolveOrgStatus } from "@/lib/org-suspension";
import { validateApiKey } from "@/lib/api-keys";
import { hasPermission } from "@/lib/rbac";
import { isSuperAdmin } from "@/lib/super-admin";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);
const mockAuth = vi.mocked(auth, true);
const mockResolveOrgStatus = vi.mocked(resolveOrgStatus);
const mockHasPermission = vi.mocked(hasPermission);
const mockIsSuperAdmin = vi.mocked(isSuperAdmin);

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
  organization: { isActive: true, suspendedAt: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveOrgStatus.mockReturnValue("active");
  vi.mocked(headers).mockResolvedValue(new Headers());
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
    expect(user.orgStatus).toBe("active");
  });

  it("derives orgStatus from the org row loaded with the user", async () => {
    mockResolveOrgStatus.mockReturnValue("read_only");

    const user = await requireApiAuth();

    expect(mockResolveOrgStatus).toHaveBeenCalledWith({
      isActive: true,
      suspendedAt: null,
    });
    expect(user.orgStatus).toBe("read_only");
  });

  it("requireApiAuth throws ForbiddenError org_locked for a locked org", async () => {
    mockResolveOrgStatus.mockReturnValue("locked_out");
    await expect(requireApiAuth()).rejects.toMatchObject({
      code: "org_locked",
    });
    await expect(requireApiAuth()).rejects.toBeInstanceOf(ForbiddenError);
    await expect(requireApiAuth()).rejects.toThrow(
      "Forbidden: Organization suspended",
    );
  });

  it("requireApiAuth does not issue a second org query", async () => {
    await requireApiAuth();
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("getAuthUser throws UnauthorizedError without a session", async () => {
    mockAuth.api.getSession.mockResolvedValue(null as any);
    await expect(requireApiAuth()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("requireWritableOrg", () => {
  it("rejects read_only and locked_out, allows active", async () => {
    const base = { id: "user-1", organizationId: "org-1" };
    await expect(
      requireWritableOrg({ ...base, orgStatus: "active" }),
    ).resolves.toBeUndefined();
    await expect(
      requireWritableOrg({ ...base, orgStatus: "read_only" }),
    ).rejects.toMatchObject({ code: "org_read_only" });
    await expect(
      requireWritableOrg({ ...base, orgStatus: "locked_out" }),
    ).rejects.toMatchObject({ code: "org_locked" });
  });

  it("keeps the historic read-only message", async () => {
    await expect(
      requireWritableOrg({ id: "user-1", orgStatus: "read_only" }),
    ).rejects.toThrow("Forbidden: Organization is in read-only mode");
  });
});

describe("requireApiCanRequest", () => {
  it("blocks a locked org", async () => {
    mockResolveOrgStatus.mockReturnValue("locked_out");
    await expect(requireApiCanRequest()).rejects.toMatchObject({
      code: "org_locked",
    });
  });

  it("throws request_permission when the user cannot request", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...activeDbUser,
      canrequest: false,
    } as any);
    await expect(requireApiCanRequest()).rejects.toMatchObject({
      code: "request_permission",
    });
  });
});

describe("requirePermission", () => {
  it("throws Forbidden for a non-admin lacking the permission", async () => {
    mockHasPermission.mockResolvedValue(false);

    await expect(requirePermission("asset:view")).rejects.toThrow(
      "Forbidden: Insufficient permissions",
    );
    await expect(requirePermission("asset:view")).rejects.toMatchObject({
      code: "insufficient_permission",
    });
  });

  it("blocks a session user of a locked org", async () => {
    mockResolveOrgStatus.mockReturnValue("locked_out");

    await expect(requirePermission("asset:view")).rejects.toMatchObject({
      code: "org_locked",
    });
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("blocks an API-key user of a locked org", async () => {
    // API-key path: validateApiKey returns a user whose org is locked.
    vi.mocked(validateApiKey).mockResolvedValue({
      id: "key-1",
      scopes: ["asset:view"],
      user: {
        ...activeDbUser,
        organization: { isActive: false, suspendedAt: null },
      },
    } as any);
    vi.mocked(headers).mockResolvedValue(
      new Headers({ authorization: "Bearer at_test_key" }),
    );
    mockResolveOrgStatus.mockReturnValue("locked_out");

    await expect(requirePermission("asset:view")).rejects.toMatchObject({
      code: "org_locked",
    });
    expect(mockResolveOrgStatus).toHaveBeenCalledWith({
      isActive: false,
      suspendedAt: null,
    });
  });

  it("throws api_key_scope when the API key lacks the scope", async () => {
    vi.mocked(validateApiKey).mockResolvedValue({
      id: "key-1",
      scopes: ["asset:view"],
      user: activeDbUser,
    } as any);
    vi.mocked(headers).mockResolvedValue(
      new Headers({ authorization: "Bearer at_test_key" }),
    );

    await expect(requirePermission("asset:delete")).rejects.toMatchObject({
      code: "api_key_scope",
    });
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
    await expect(requireApiAdmin()).rejects.toMatchObject({
      code: "not_admin",
    });
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
  beforeEach(() => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...activeDbUser,
      isadmin: true,
    } as any);
    mockIsSuperAdmin.mockResolvedValue(false);
  });

  it("throws ForbiddenError not_super_admin when isSuperAdmin denies", async () => {
    await expect(requireSuperAdmin()).rejects.toBeInstanceOf(ForbiddenError);
    await expect(requireSuperAdmin()).rejects.toMatchObject({
      code: "not_super_admin",
    });
    await expect(requireSuperAdmin()).rejects.toThrow(
      "Forbidden: Super-admin access required",
    );
  });

  it("asks isSuperAdmin about the authenticated user", async () => {
    await expect(requireSuperAdmin()).rejects.toThrow();

    expect(mockIsSuperAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-1",
        email: "jane@example.com",
      }),
    );
  });

  it("returns the user when isSuperAdmin allows", async () => {
    mockIsSuperAdmin.mockResolvedValue(true);

    const user = await requireSuperAdmin();

    expect(user.id).toBe("user-1");
    expect(user.isAdmin).toBe(true);
  });

  it("rejects a non-admin before consulting isSuperAdmin", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(activeDbUser as any);
    mockIsSuperAdmin.mockResolvedValue(true);

    await expect(requireSuperAdmin()).rejects.toMatchObject({
      code: "not_admin",
    });
    expect(mockIsSuperAdmin).not.toHaveBeenCalled();
  });
});
