import prisma from './prisma';

/**
 * Available permissions in the system
 */
export const PERMISSIONS = {
  // Assets
  'asset:view': 'View assets',
  'asset:create': 'Create assets',
  'asset:edit': 'Edit assets',
  'asset:delete': 'Delete assets',
  'asset:assign': 'Assign assets to users',

  // Users
  'user:view': 'View users',
  'user:create': 'Create users',
  'user:edit': 'Edit users',
  'user:delete': 'Delete users',

  // Accessories
  'accessory:view': 'View accessories',
  'accessory:create': 'Create accessories',
  'accessory:edit': 'Edit accessories',
  'accessory:delete': 'Delete accessories',

  // Licenses
  'license:view': 'View licenses',
  'license:create': 'Create licenses',
  'license:edit': 'Edit licenses',
  'license:delete': 'Delete licenses',
  'license:assign': 'Assign licenses',

  // Consumables
  'consumable:view': 'View consumables',
  'consumable:create': 'Create consumables',
  'consumable:edit': 'Edit consumables',
  'consumable:delete': 'Delete consumables',

  // Organizations & Departments
  'org:view': 'View organizations',
  'org:manage': 'Manage organizations',
  'dept:view': 'View departments',
  'dept:manage': 'Manage departments',

  // Reservations
  'reservation:view': 'View reservations',
  'reservation:create': 'Create reservations',
  'reservation:approve': 'Approve/reject reservations',

  // Settings
  'settings:view': 'View settings',
  'settings:edit': 'Edit settings',

  // Reports
  'report:view': 'View reports',
  'report:export': 'Export reports',

  // Audit logs
  'audit:view': 'View audit logs',

  // Webhooks
  'webhook:view': 'View webhooks',
  'webhook:manage': 'Manage webhooks',

  // Import
  'import:execute': 'Execute bulk imports',

  // Components
  'component:view': 'View components',
  'component:create': 'Create components',
  'component:edit': 'Edit components',
  'component:delete': 'Delete components',

  // EULA
  'eula:view': 'View EULA templates',
  'eula:manage': 'Manage EULA templates',

  // Kits
  'kit:view': 'View predefined kits',
  'kit:create': 'Create predefined kits',
  'kit:edit': 'Edit predefined kits',
  'kit:delete': 'Delete predefined kits',
  'kit:checkout': 'Checkout predefined kits',

  // Audits
  'audit_campaign:view': 'View audit campaigns',
  'audit_campaign:create': 'Create audit campaigns',
  'audit_campaign:edit': 'Edit audit campaigns',
  'audit_campaign:scan': 'Scan assets in audit campaigns',
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Default role definitions
 */
export const DEFAULT_ROLES = {
  admin: {
    name: 'Administrator',
    description: 'Full system access',
    permissions: Object.keys(PERMISSIONS) as Permission[],
    isSystem: true,
  },
  manager: {
    name: 'Asset Manager',
    description: 'Can manage assets and assignments',
    permissions: [
      'asset:view', 'asset:create', 'asset:edit', 'asset:assign',
      'accessory:view', 'accessory:create', 'accessory:edit',
      'license:view', 'license:assign',
      'consumable:view',
      'component:view', 'component:create', 'component:edit',
      'kit:view', 'kit:checkout',
      'audit_campaign:view', 'audit_campaign:scan',
      'reservation:view', 'reservation:approve',
      'report:view', 'report:export',
    ] as Permission[],
    isSystem: true,
  },
  user: {
    name: 'Standard User',
    description: 'View-only access with request capabilities',
    permissions: [
      'asset:view',
      'accessory:view',
      'license:view',
      'consumable:view',
      'component:view',
      'kit:view',
      'reservation:view', 'reservation:create',
      'report:view',
    ] as Permission[],
    isSystem: true,
  },
} as const;

/**
 * Get all permissions for a user, including admin override
 */
export async function getUserPermissions(userId: string): Promise<Set<Permission>> {
  const userWithRoles = await prisma.user.findUnique({
    where: { userid: userId },
    include: {
      roles: {
        include: {
          role: true
        }
      }
    }
  });

  if (!userWithRoles) {
    return new Set();
  }

  // Admin users get all permissions
  if (userWithRoles.isadmin) {
    return new Set(Object.keys(PERMISSIONS) as Permission[]);
  }

  const permissions = new Set<Permission>();

  userWithRoles.roles.forEach(userRole => {
    userRole.role.permissions.forEach(perm => {
      if (perm in PERMISSIONS) {
        permissions.add(perm as Permission);
      }
    });
  });

  return permissions;
}

/**
 * Check if a user has a specific permission
 */
export async function hasPermission(userId: string, permission: Permission): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissions.has(permission);
}

/**
 * Check if a user has any of the specified permissions
 */
export async function hasAnyPermission(userId: string, permissions: Permission[]): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId);
  return permissions.some(perm => userPermissions.has(perm));
}

/**
 * Check if a user has all of the specified permissions
 */
export async function hasAllPermissions(userId: string, permissions: Permission[]): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId);
  return permissions.every(perm => userPermissions.has(perm));
}

/**
 * Create a permission guard function
 */
export function createPermissionGuard(requiredPermissions: Permission[]) {
  return async (userId: string) => {
    return await hasAllPermissions(userId, requiredPermissions);
  };
}

/**
 * Get all available permissions as an array
 */
export function getAllPermissions(): { key: Permission; description: string }[] {
  return Object.entries(PERMISSIONS).map(([key, description]) => ({
    key: key as Permission,
    description,
  }));
}
