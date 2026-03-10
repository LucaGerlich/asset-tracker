import prisma from "./prisma";
import { hasPermission } from "./rbac";
import type { AuthUser } from "./api-auth";

/**
 * Recursively collect a department's ID and all descendant department IDs.
 *
 * Fetches all departments for the organization in a single query and resolves
 * the tree in memory to avoid the N+1 pattern that iterative BFS would cause.
 */
export async function getDepartmentAndDescendants(
  departmentId: string,
  organizationId?: string | null,
): Promise<string[]> {
  // Load all departments for the organization (or all if no org filter) in one query
  const allDepts = await prisma.department.findMany({
    where: organizationId ? { organizationId } : {},
    select: { id: true, parentId: true },
  });

  // Build a parent → children map for fast lookup
  const childrenOf = new Map<string, string[]>();
  for (const dept of allDepts) {
    if (dept.parentId) {
      const siblings = childrenOf.get(dept.parentId) ?? [];
      siblings.push(dept.id);
      childrenOf.set(dept.parentId, siblings);
    }
  }

  // BFS from the target department using the in-memory map
  const ids: string[] = [departmentId];
  const queue: string[] = [departmentId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = childrenOf.get(currentId) ?? [];
    for (const childId of children) {
      ids.push(childId);
      queue.push(childId);
    }
  }

  return ids;
}

/**
 * Determine which department IDs are visible to the given user.
 *
 * Returns `null`  → user has cross-department visibility (admin or dept:view holder).
 * Returns `[]`    → user has no department; they can only see their own record.
 * Returns `[...]` → user can see these department IDs (own dept + descendants).
 */
export async function getVisibleDepartmentIds(
  authUser: AuthUser,
): Promise<string[] | null> {
  // Admin users bypass all department restrictions
  if (authUser.isAdmin) {
    return null;
  }

  // Users with the dept:view permission have cross-department visibility
  // (this covers the "Asset Manager" role and higher)
  if (authUser.id) {
    const canViewAllDepts = await hasPermission(authUser.id, "dept:view");
    if (canViewAllDepts) {
      return null;
    }
  }

  // Standard users with no department assigned: restricted to own record only
  if (!authUser.departmentId) {
    return [];
  }

  // Return own department and all its descendants (hierarchy support)
  return getDepartmentAndDescendants(
    authUser.departmentId,
    authUser.organizationId,
  );
}

/**
 * Apply department-based scoping to a Prisma `where` clause used for user queries.
 *
 * - Admin / dept:view holders → no additional filter (cross-department).
 * - Users with a department  → filter to own department tree.
 * - Users with no department → filter to only their own user record.
 */
export async function applyDepartmentScopeToUsers(
  where: Record<string, unknown>,
  authUser: AuthUser,
): Promise<Record<string, unknown>> {
  const visibleIds = await getVisibleDepartmentIds(authUser);

  // null → no department restriction
  if (visibleIds === null) {
    return where;
  }

  // [] → no department assigned; scope to the user's own record only
  if (visibleIds.length === 0) {
    const selfId = authUser.id ?? "";
    return { ...where, userid: selfId };
  }

  // Scope to users whose departmentId is within the visible set
  return {
    ...where,
    departmentId: { in: visibleIds },
  };
}
