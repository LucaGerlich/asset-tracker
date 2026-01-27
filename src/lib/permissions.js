/**
 * Permission definitions for Role-Based Access Control
 */
export const PERMISSIONS = {
  // Assets
  ASSET_VIEW: "asset:view",
  ASSET_CREATE: "asset:create",
  ASSET_EDIT: "asset:edit",
  ASSET_DELETE: "asset:delete",
  ASSET_ASSIGN: "asset:assign",

  // Users
  USER_VIEW: "user:view",
  USER_CREATE: "user:create",
  USER_EDIT: "user:edit",
  USER_DELETE: "user:delete",

  // Accessories
  ACCESSORY_VIEW: "accessory:view",
  ACCESSORY_CREATE: "accessory:create",
  ACCESSORY_EDIT: "accessory:edit",
  ACCESSORY_DELETE: "accessory:delete",
  ACCESSORY_REQUEST: "accessory:request",

  // Licenses
  LICENSE_VIEW: "license:view",
  LICENSE_CREATE: "license:create",
  LICENSE_EDIT: "license:edit",
  LICENSE_DELETE: "license:delete",

  // Settings
  SETTINGS_VIEW: "settings:view",
  SETTINGS_EDIT: "settings:edit",

  // Categories/Manufacturers/Suppliers
  CATALOG_MANAGE: "catalog:manage",
};

/**
 * Check if a user has a specific permission
 * @param {Object} user - User object with isAdmin and canRequest properties
 * @param {string} permission - Permission to check
 * @returns {boolean} True if user has permission
 */
export function userHasPermission(user, permission) {
  if (!user) return false;

  // Admins have all permissions
  if (user.isAdmin) {
    return true;
  }

  // Regular users permissions
  switch (permission) {
    // View permissions - all authenticated users
    case PERMISSIONS.ASSET_VIEW:
    case PERMISSIONS.USER_VIEW:
    case PERMISSIONS.ACCESSORY_VIEW:
    case PERMISSIONS.LICENSE_VIEW:
    case PERMISSIONS.SETTINGS_VIEW:
      return true;

    // Request permissions - users with canRequest
    case PERMISSIONS.ACCESSORY_REQUEST:
      return user.canRequest;

    // Edit own profile
    case PERMISSIONS.USER_EDIT:
      return true; // Can edit own profile (check userId separately)

    // Everything else requires admin
    default:
      return false;
  }
}

/**
 * Check if current user can edit a specific user
 * @param {Object} currentUser - Current user object
 * @param {string} targetUserId - ID of the user to edit
 * @returns {boolean} True if can edit
 */
export function userCanEditUser(currentUser, targetUserId) {
  if (!currentUser) return false;

  // Admins can edit anyone
  if (currentUser.isAdmin) {
    return true;
  }

  // Users can only edit themselves
  return currentUser.id === targetUserId;
}

/**
 * Check if current user can delete a specific user
 * @param {Object} currentUser - Current user object
 * @param {string} targetUserId - ID of the user to delete
 * @returns {boolean} True if can delete
 */
export function userCanDeleteUser(currentUser, targetUserId) {
  if (!currentUser) return false;

  // Only admins can delete users
  if (!currentUser.isAdmin) {
    return false;
  }

  // Admins cannot delete themselves
  return currentUser.id !== targetUserId;
}
