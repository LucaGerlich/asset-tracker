import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing department-access
vi.mock("@/lib/prisma", () => ({
  default: {
    department: {
      findMany: vi.fn(),
    },
  },
}));

// Mock rbac
vi.mock("@/lib/rbac", () => ({
  hasPermission: vi.fn(),
}));

import {
  getDepartmentAndDescendants,
  getVisibleDepartmentIds,
  applyDepartmentScopeToUsers,
} from "../department-access";
import prisma from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

const mockPrisma = vi.mocked(prisma);
const mockHasPermission = vi.mocked(hasPermission);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getDepartmentAndDescendants
// ---------------------------------------------------------------------------
describe("getDepartmentAndDescendants", () => {
  it("returns just the root id when there are no departments", async () => {
    mockPrisma.department.findMany.mockResolvedValue([]);
    const ids = await getDepartmentAndDescendants("dept-1");
    expect(ids).toEqual(["dept-1"]);
  });

  it("includes direct children", async () => {
    mockPrisma.department.findMany.mockResolvedValue([
      { id: "dept-2", parentId: "dept-1" },
      { id: "dept-3", parentId: "dept-1" },
    ] as any);

    const ids = await getDepartmentAndDescendants("dept-1");
    expect(ids).toContain("dept-1");
    expect(ids).toContain("dept-2");
    expect(ids).toContain("dept-3");
    expect(ids).toHaveLength(3);
  });

  it("includes grandchildren (recursive hierarchy)", async () => {
    mockPrisma.department.findMany.mockResolvedValue([
      { id: "dept-2", parentId: "dept-1" },
      { id: "dept-3", parentId: "dept-2" },
    ] as any);

    const ids = await getDepartmentAndDescendants("dept-1");
    expect(ids).toContain("dept-1");
    expect(ids).toContain("dept-2");
    expect(ids).toContain("dept-3");
  });

  it("only includes descendants of the target, not unrelated departments", async () => {
    mockPrisma.department.findMany.mockResolvedValue([
      { id: "dept-2", parentId: "dept-1" },
      { id: "dept-99", parentId: "other-root" },
    ] as any);

    const ids = await getDepartmentAndDescendants("dept-1");
    expect(ids).toContain("dept-1");
    expect(ids).toContain("dept-2");
    expect(ids).not.toContain("dept-99");
  });

  it("passes organizationId filter when provided", async () => {
    mockPrisma.department.findMany.mockResolvedValue([]);
    await getDepartmentAndDescendants("dept-1", "org-1");
    expect(mockPrisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1" },
      }),
    );
  });

  it("uses empty where when no organizationId provided", async () => {
    mockPrisma.department.findMany.mockResolvedValue([]);
    await getDepartmentAndDescendants("dept-1");
    expect(mockPrisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it("makes exactly one database query regardless of hierarchy depth", async () => {
    mockPrisma.department.findMany.mockResolvedValue([
      { id: "dept-2", parentId: "dept-1" },
      { id: "dept-3", parentId: "dept-2" },
      { id: "dept-4", parentId: "dept-3" },
    ] as any);

    await getDepartmentAndDescendants("dept-1");
    expect(mockPrisma.department.findMany).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getVisibleDepartmentIds
// ---------------------------------------------------------------------------
describe("getVisibleDepartmentIds", () => {
  it("returns null for admin users (cross-department access)", async () => {
    const result = await getVisibleDepartmentIds({ id: "u1", isAdmin: true });
    expect(result).toBeNull();
  });

  it("returns null when user has dept:view permission (manager)", async () => {
    mockHasPermission.mockResolvedValue(true);
    const result = await getVisibleDepartmentIds({
      id: "u1",
      isAdmin: false,
      departmentId: "dept-1",
    });
    expect(result).toBeNull();
    expect(mockHasPermission).toHaveBeenCalledWith("u1", "dept:view");
  });

  it("returns empty array when user has no department and no dept:view", async () => {
    mockHasPermission.mockResolvedValue(false);
    const result = await getVisibleDepartmentIds({
      id: "u1",
      isAdmin: false,
      departmentId: null,
    });
    expect(result).toEqual([]);
  });

  it("returns own dept + descendants when user has a department but no dept:view", async () => {
    mockHasPermission.mockResolvedValue(false);
    mockPrisma.department.findMany.mockResolvedValue([
      { id: "dept-2", parentId: "dept-1" },
    ] as any);

    const result = await getVisibleDepartmentIds({
      id: "u1",
      isAdmin: false,
      departmentId: "dept-1",
      organizationId: "org-1",
    });

    expect(result).toContain("dept-1");
    expect(result).toContain("dept-2");
  });

  it("does not call hasPermission for admin users", async () => {
    await getVisibleDepartmentIds({ id: "u1", isAdmin: true });
    expect(mockHasPermission).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// applyDepartmentScopeToUsers
// ---------------------------------------------------------------------------
describe("applyDepartmentScopeToUsers", () => {
  it("returns original where unchanged for admin users", async () => {
    const where = { organizationId: "org-1" };
    const result = await applyDepartmentScopeToUsers(where, {
      id: "u1",
      isAdmin: true,
    });
    expect(result).toEqual(where);
  });

  it("restricts to own record (userid) when user has no department", async () => {
    mockHasPermission.mockResolvedValue(false);
    const result = await applyDepartmentScopeToUsers(
      { organizationId: "org-1" },
      { id: "u1", isAdmin: false, departmentId: null },
    );
    expect(result).toMatchObject({ userid: "u1" });
  });

  it("scopes to departmentId { in: [...] } when user has a department", async () => {
    mockHasPermission.mockResolvedValue(false);
    mockPrisma.department.findMany.mockResolvedValue([]);

    const result = await applyDepartmentScopeToUsers(
      { organizationId: "org-1" },
      {
        id: "u1",
        isAdmin: false,
        departmentId: "dept-1",
        organizationId: "org-1",
      },
    );
    expect(result).toMatchObject({
      departmentId: { in: ["dept-1"] },
    });
  });

  it("includes descendant department IDs in the scope", async () => {
    mockHasPermission.mockResolvedValue(false);
    mockPrisma.department.findMany.mockResolvedValue([
      { id: "dept-2", parentId: "dept-1" },
    ] as any);

    const result = await applyDepartmentScopeToUsers(
      {},
      { id: "u1", isAdmin: false, departmentId: "dept-1" },
    );
    expect(result).toMatchObject({
      departmentId: { in: expect.arrayContaining(["dept-1", "dept-2"]) },
    });
  });

  it("returns original where for users with dept:view permission", async () => {
    mockHasPermission.mockResolvedValue(true);
    const where = { organizationId: "org-1" };
    const result = await applyDepartmentScopeToUsers(where, {
      id: "u1",
      isAdmin: false,
      departmentId: "dept-1",
    });
    expect(result).toEqual(where);
  });

  it("preserves existing where conditions when scoping", async () => {
    mockHasPermission.mockResolvedValue(false);
    mockPrisma.department.findMany.mockResolvedValue([]);

    const result = await applyDepartmentScopeToUsers(
      { organizationId: "org-1", isActive: true },
      { id: "u1", isAdmin: false, departmentId: "dept-1" },
    );
    expect(result).toMatchObject({ organizationId: "org-1", isActive: true });
    expect(result).toHaveProperty("departmentId");
  });
});
