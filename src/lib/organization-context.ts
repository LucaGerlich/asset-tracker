import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "./prisma";

/** Typed interface for dynamic Prisma model access */
interface PrismaDelegate {
  findFirst: (args: Record<string, unknown>) => Promise<unknown>;
}

/** Safely access a Prisma delegate by name for dynamic model queries. */
function getPrismaDelegate(name: string): PrismaDelegate | undefined {
  const delegate: unknown =
    name in prisma ? prisma[name as keyof typeof prisma] : undefined;
  if (delegate && typeof delegate === "object" && "findFirst" in delegate) {
    return delegate as PrismaDelegate;
  }
  return undefined;
}

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
 * Get the organization context for the current user.
 * Works with both session (cookie) and API key authentication.
 */
export async function getOrganizationContext(): Promise<OrganizationContext | null> {
  // Try session auth first
  let userId: string | undefined;

  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.id) {
    userId = session.user.id;
  }

  // Fall back to API key auth if no session
  if (!userId) {
    try {
      const { getAuthUser } = await import("./api-auth");
      const authUser = await getAuthUser();
      userId = authUser.id;
    } catch {
      return null;
    }
  }

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { userid: userId },
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
/**
 * Scope a Prisma where clause to the user's organization.
 * Strict scoping — only returns records matching the user's org.
 */
export function scopeToOrganization<T extends Record<string, unknown>>(
  baseWhere: T,
  organizationId?: string | null,
): T {
  if (!organizationId) {
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

  return resourceOrganizationId === userOrganizationId;
}

/**
 * Verify that an entity (asset, accessory, consumable, licence) belongs to
 * the given organization. Used to prevent cross-tenant data access.
 */
export async function verifyEntityOrgOwnership(
  entityType: string,
  entityId: string,
  organizationId: string | null | undefined,
): Promise<boolean> {
  // Maps request entity types to Prisma model delegates and their PK field.
  // Model names must match the Prisma schema exactly.
  const modelMap: Record<string, { delegate: string; idField: string }> = {
    asset: { delegate: "asset", idField: "assetid" },
    accessory: { delegate: "accessories", idField: "accessorieid" },
    consumable: { delegate: "consumable", idField: "consumableid" },
    licence: { delegate: "licence", idField: "licenceid" },
    component: { delegate: "Component", idField: "id" },
  };

  const config = modelMap[entityType];
  if (!config) return false;

  // Dynamic Prisma model access — delegate names are validated by the map above
  const model = getPrismaDelegate(config.delegate);
  if (!model?.findFirst) return false;

  const entity = await model.findFirst({
    where: {
      [config.idField]: entityId,
      organizationId: organizationId ?? null,
    },
    select: { [config.idField]: true },
  });

  return !!entity;
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
