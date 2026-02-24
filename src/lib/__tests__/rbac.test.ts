import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing rbac
vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import {
  getUserPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getAllPermissions,
  PERMISSIONS,
  createPermissionGuard,
} from "../rbac";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getUserPermissions", () => {
  it("returns empty set for nonexistent user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const perms = await getUserPermissions("nonexistent");
    expect(perms.size).toBe(0);
  });

  it("returns all permissions for admin user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isadmin: true,
      roles: [],
    } as any);
    const perms = await getUserPermissions("admin-id");
    const allKeys = Object.keys(PERMISSIONS);
    expect(perms.size).toBe(allKeys.length);
    allKeys.forEach((key) => {
      expect(perms.has(key as any)).toBe(true);
    });
  });

  it("aggregates permissions from user roles", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isadmin: false,
      roles: [
        { role: { permissions: ["asset:view", "asset:create"] } },
        { role: { permissions: ["user:view"] } },
      ],
    } as any);
    const perms = await getUserPermissions("user-id");
    expect(perms.has("asset:view")).toBe(true);
    expect(perms.has("asset:create")).toBe(true);
    expect(perms.has("user:view")).toBe(true);
    expect(perms.has("user:delete" as any)).toBe(false);
  });

  it("ignores invalid permission strings from roles", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isadmin: false,
      roles: [{ role: { permissions: ["asset:view", "invalid:perm"] } }],
    } as any);
    const perms = await getUserPermissions("user-id");
    expect(perms.has("asset:view")).toBe(true);
    expect(perms.size).toBe(1);
  });

  it("deduplicates permissions across roles", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isadmin: false,
      roles: [
        { role: { permissions: ["asset:view", "asset:create"] } },
        { role: { permissions: ["asset:view", "user:view"] } },
      ],
    } as any);
    const perms = await getUserPermissions("user-id");
    expect(perms.size).toBe(3);
  });

  it("returns empty set for non-admin user with no roles", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isadmin: false,
      roles: [],
    } as any);
    const perms = await getUserPermissions("user-id");
    expect(perms.size).toBe(0);
  });
});

describe("hasPermission", () => {
  it("returns true when user has the permission", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isadmin: false,
      roles: [{ role: { permissions: ["asset:view"] } }],
    } as any);
    expect(await hasPermission("user-id", "asset:view")).toBe(true);
  });

  it("returns false when user lacks the permission", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isadmin: false,
      roles: [{ role: { permissions: ["asset:view"] } }],
    } as any);
    expect(await hasPermission("user-id", "asset:delete")).toBe(false);
  });
});

describe("hasAnyPermission", () => {
  it("returns true when user has at least one permission", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isadmin: false,
      roles: [{ role: { permissions: ["asset:view"] } }],
    } as any);
    expect(
      await hasAnyPermission("user-id", ["asset:view", "asset:delete"]),
    ).toBe(true);
  });

  it("returns false when user has none of the permissions", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isadmin: false,
      roles: [{ role: { permissions: ["asset:view"] } }],
    } as any);
    expect(
      await hasAnyPermission("user-id", ["asset:delete", "user:delete"]),
    ).toBe(false);
  });
});

describe("hasAllPermissions", () => {
  it("returns true when user has all permissions", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isadmin: false,
      roles: [{ role: { permissions: ["asset:view", "asset:create"] } }],
    } as any);
    expect(
      await hasAllPermissions("user-id", ["asset:view", "asset:create"]),
    ).toBe(true);
  });

  it("returns false when user is missing any permission", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isadmin: false,
      roles: [{ role: { permissions: ["asset:view"] } }],
    } as any);
    expect(
      await hasAllPermissions("user-id", ["asset:view", "asset:create"]),
    ).toBe(false);
  });
});

describe("createPermissionGuard", () => {
  it("returns a function that checks permissions", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isadmin: false,
      roles: [{ role: { permissions: ["asset:view", "asset:create"] } }],
    } as any);
    const guard = createPermissionGuard(["asset:view", "asset:create"]);
    expect(await guard("user-id")).toBe(true);
  });

  it("guard returns false when permissions are insufficient", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      isadmin: false,
      roles: [{ role: { permissions: ["asset:view"] } }],
    } as any);
    const guard = createPermissionGuard(["asset:view", "asset:delete"]);
    expect(await guard("user-id")).toBe(false);
  });
});

describe("getAllPermissions", () => {
  it("returns array of permission objects with key and description", () => {
    const all = getAllPermissions();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(0);
    all.forEach((p) => {
      expect(p).toHaveProperty("key");
      expect(p).toHaveProperty("description");
      expect(typeof p.key).toBe("string");
      expect(typeof p.description).toBe("string");
    });
  });

  it("includes all defined permissions", () => {
    const all = getAllPermissions();
    const keys = all.map((p) => p.key);
    Object.keys(PERMISSIONS).forEach((key) => {
      expect(keys).toContain(key);
    });
  });
});
