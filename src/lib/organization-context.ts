import { auth } from "@/auth";
import prisma from "./prisma";

export interface OrganizationContext {
  organization: {
    id: string;
    name: string;
    slug: string;
    settings: Record<string, unknown> | null;
  } | null;
  userId: string;
  departmentId: string | null;
  isAdmin: boolean;
  permissions: Set<string>;
}

/**
 * Get the organization context for the current user session
 */
export async function getOrganizationContext(): Promise<OrganizationContext | null> {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { userid: session.user.id },
    include: {
      organization: true,
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  // Collect permissions from roles
  const permissions = new Set<string>();
  user.roles.forEach((userRole) => {
    userRole.role.permissions.forEach((perm) => {
      permissions.add(perm);
    });
  });

  // Admins have all permissions
  if (user.isadmin) {
    // Import permission list from rbac
    const { PERMISSIONS } = await import("./rbac");
    Object.keys(PERMISSIONS).forEach((perm) => permissions.add(perm));
  }

  return {
    organization: user.organization
      ? {
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug,
          settings: user.organization.settings as Record<
            string,
            unknown
          > | null,
        }
      : null,
    userId: user.userid,
    departmentId: user.departmentId,
    isAdmin: user.isadmin,
    permissions,
  };
}

/**
 * Scope a Prisma where clause to the user's organization
 * Returns the original where if user has no organization (for backward compatibility)
 */
export function scopeToOrganization<T extends Record<string, unknown>>(
  baseWhere: T,
  organizationId?: string | null,
): T {
  if (!organizationId) {
    // Fail closed: when no org is available, only match records with no org
    // This prevents users without an organization from seeing all tenant data
    return {
      ...baseWhere,
      organizationId: null,
    };
  }

  return {
    ...baseWhere,
    organizationId,
  };
}

/**
 * Check if the current user can access a resource based on organization
 */
export async function canAccessResource(
  resourceOrganizationId: string | null | undefined,
  userOrganizationId: string | null | undefined,
  isAdmin: boolean,
): Promise<boolean> {
  // Admins can access resources within their own organization or unscoped resources
  if (isAdmin) {
    if (!resourceOrganizationId) return true;
    if (!userOrganizationId) return true;
    return resourceOrganizationId === userOrganizationId;
  }

  // If resource has no organization, it's accessible by all
  if (!resourceOrganizationId) {
    return true;
  }

  // If user has no organization but resource does, deny access
  if (!userOrganizationId) {
    return false;
  }

  // Check if organizations match
  return resourceOrganizationId === userOrganizationId;
}

/**
 * Get organization by slug
 */
export async function getOrganizationBySlug(slug: string) {
  return prisma.organization.findUnique({
    where: { slug },
    include: {
      departments: {
        where: { parentId: null }, // Top-level departments only
        include: {
          children: true,
        },
      },
      _count: {
        select: {
          users: true,
          assets: true,
          accessories: true,
          licences: true,
          consumables: true,
        },
      },
    },
  });
}
