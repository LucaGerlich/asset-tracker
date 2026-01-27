"use client";

import { usePermissions } from "@/hooks/usePermissions";

/**
 * Permission-based component guard
 * Only renders children if user has the required permission
 */
export function PermissionGuard({ permission, children, fallback = null }) {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permission)) {
    return fallback;
  }

  return <>{children}</>;
}

/**
 * Admin-only component guard
 * Only renders children if user is an admin
 */
export function AdminGuard({ children, fallback = null }) {
  const { isAdmin } = usePermissions();

  if (!isAdmin()) {
    return fallback;
  }

  return <>{children}</>;
}

/**
 * Request permission component guard
 * Only renders children if user has request permission or is admin
 */
export function RequestGuard({ children, fallback = null }) {
  const { canRequest, isAdmin } = usePermissions();

  if (!canRequest() && !isAdmin()) {
    return fallback;
  }

  return <>{children}</>;
}
